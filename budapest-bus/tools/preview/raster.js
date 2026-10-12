/**
 * The software rasteriser at the heart of the offline preview renderer.
 *
 * Pipeline per triangle:
 *   1. world-space back-face test (respecting `doubleSided`),
 *   2. transform to clip space, near-plane clip (Sutherland-Hodgman),
 *   3. perspective divide + viewport transform,
 *   4. screen-space edge-function rasterisation with a z-buffer,
 *   5. perspective-correct interpolation of 1/w, world pos, normal and UV,
 *   6. Cook-Torrance shading (see ./shading.js).
 *
 * Opaque meshes are drawn first (depth test + write, alpha test).  Transparent
 * meshes are collected and drawn afterwards back-to-front by centroid depth,
 * with depth test on but depth write off, alpha blended in linear space.
 *
 * The renderer always draws at `ss` times the requested resolution and box
 * downsamples, which gives cheap anti-aliasing for free.
 */

import { Image } from '../../src/core/image.js';
import {
  transformPoint,
  sub,
  cross,
  dot,
  normalize,
  length,
  clamp,
  linearToSrgb,
} from './math.js';
import { compileMaterials, FALLBACK_MATERIAL, shadeSurface } from './shading.js';
import { fillSky, makeGroundPlane } from './scene.js';

const NEAR_W = 1e-4;

// ---------------------------------------------------------------------------
// clip-space vertices
// ---------------------------------------------------------------------------

/** A vertex carrying everything the rasteriser needs through clipping. */
function makeClipVertex() {
  return { cx: 0, cy: 0, cz: 0, cw: 0, wx: 0, wy: 0, wz: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0 };
}

/** @param {object} out @param {object} a @param {object} b @param {number} t */
function lerpClip(out, a, b, t) {
  out.cx = a.cx + (b.cx - a.cx) * t;
  out.cy = a.cy + (b.cy - a.cy) * t;
  out.cz = a.cz + (b.cz - a.cz) * t;
  out.cw = a.cw + (b.cw - a.cw) * t;
  out.wx = a.wx + (b.wx - a.wx) * t;
  out.wy = a.wy + (b.wy - a.wy) * t;
  out.wz = a.wz + (b.wz - a.wz) * t;
  out.nx = a.nx + (b.nx - a.nx) * t;
  out.ny = a.ny + (b.ny - a.ny) * t;
  out.nz = a.nz + (b.nz - a.nz) * t;
  out.u = a.u + (b.u - a.u) * t;
  out.v = a.v + (b.v - a.v) * t;
  return out;
}

/**
 * Clip a polygon against the near plane `w >= NEAR_W` (homogeneous, so a
 * straight lerp of the clip attributes is correct).
 * @param {object[]} poly @param {object[]} pool reusable vertex pool
 * @returns {object[]}
 */
function clipNear(poly, pool) {
  const out = [];
  const n = poly.length;
  let poolIdx = 0;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % n];
    const curIn = cur.cw >= NEAR_W;
    const nxtIn = nxt.cw >= NEAR_W;
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) {
      const t = (NEAR_W - cur.cw) / (nxt.cw - cur.cw);
      const v = pool[poolIdx++] ?? (pool[poolIdx - 1] = makeClipVertex());
      out.push(lerpClip(v, cur, nxt, t));
    }
  }
  return out;
}


// ---------------------------------------------------------------------------
// projection + rasterisation
// ---------------------------------------------------------------------------

/** Perspective divide + viewport transform into a reusable record. */
function projectVertex(v, camera, W, H, out) {
  const iw = 1 / v.cw;
  out.X = (v.cx * iw * 0.5 + 0.5) * W;
  out.Y = (0.5 - v.cy * iw * 0.5) * H;
  out.IW = iw;
  out.WX = v.wx * iw;
  out.WY = v.wy * iw;
  out.WZ = v.wz * iw;
  out.NX = v.nx * iw;
  out.NY = v.ny * iw;
  out.NZ = v.nz * iw;
  out.U = v.u * iw;
  out.V = v.v * iw;
  out.CW = v.cw;
  return out;
}

/**
 * Rasterise one screen-space triangle with perspective-correct interpolation.
 * @param {object} ctx render context
 * @param {object} A @param {object} B @param {object} C projected vertices
 * @param {object} mat compiled material
 * @param {number[]} geoN world-space geometric normal (fallback / flip test)
 * @param {boolean} opaque true for the depth-writing opaque pass
 */
function rasterTriangle(ctx, A, B, C, mat, geoN, opaque) {
  const area = (B.X - A.X) * (C.Y - A.Y) - (C.X - A.X) * (B.Y - A.Y);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-9) return;

  const minX = Math.max(0, Math.floor(Math.min(A.X, B.X, C.X)));
  const maxX = Math.min(ctx.W - 1, Math.ceil(Math.max(A.X, B.X, C.X)));
  const minY = Math.max(0, Math.floor(Math.min(A.Y, B.Y, C.Y)));
  const maxY = Math.min(ctx.H - 1, Math.ceil(Math.max(A.Y, B.Y, C.Y)));
  if (minX > maxX || minY > maxY) return;

  ctx.rendered++;
  if (ctx.trackModel) {
    const mb = ctx.modelBounds;
    if (minX < mb.minX) mb.minX = minX;
    if (minY < mb.minY) mb.minY = minY;
    if (maxX > mb.maxX) mb.maxX = maxX;
    if (maxY > mb.maxY) mb.maxY = maxY;
  }

  const fb = ctx.fb;
  const depthBuf = ctx.depth;
  const W = ctx.W;
  const out = ctx.tmp;
  const N = ctx.shadeNormal;
  const mask = ctx.mask;

  for (let py = minY; py <= maxY; py++) {
    const fy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const fx = px + 0.5;
      const lc = ((B.X - A.X) * (fy - A.Y) - (B.Y - A.Y) * (fx - A.X)) / area;
      const lb = ((fx - A.X) * (C.Y - A.Y) - (fy - A.Y) * (C.X - A.X)) / area;
      const la = 1 - lb - lc;
      if (la < -1e-6 || lb < -1e-6 || lc < -1e-6) continue;

      const iw = la * A.IW + lb * B.IW + lc * C.IW;
      if (!(iw > 0)) continue;
      const z = 1 / iw;
      const idx = py * W + px;
      if (z >= depthBuf[idx]) continue;

      const wx = (la * A.WX + lb * B.WX + lc * C.WX) / iw;
      const wy = (la * A.WY + lb * B.WY + lc * C.WY) / iw;
      const wz = (la * A.WZ + lb * B.WZ + lc * C.WZ) / iw;
      const u = (la * A.U + lb * B.U + lc * C.U) / iw;
      const v = (la * A.V + lb * B.V + lc * C.V) / iw;

      let nx = (la * A.NX + lb * B.NX + lc * C.NX) / iw;
      let ny = (la * A.NY + lb * B.NY + lc * C.NY) / iw;
      let nz = (la * A.NZ + lb * B.NZ + lc * C.NZ) / iw;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-6) {
        nx = geoN[0]; ny = geoN[1]; nz = geoN[2];
      } else {
        nx /= nl; ny /= nl; nz /= nl;
      }
      N[0] = nx; N[1] = ny; N[2] = nz;
      const pos = ctx.shadePos;
      pos[0] = wx; pos[1] = wy; pos[2] = wz;
      const V = ctx.camera.viewDirFrom(pos);
      shadeSurface(mat, N, V, pos, u, v, out);

      const a = out[3];
      const i4 = idx * 4;
      if (opaque) {
        if (!(a >= 0.5)) continue; // alpha test for cut-out textures
        depthBuf[idx] = z;
        if (ctx.trackModel) mask[idx] = 1;
        fb[i4] = out[0];
        fb[i4 + 1] = out[1];
        fb[i4 + 2] = out[2];
        fb[i4 + 3] = 1;
      } else {
        if (a <= 0.002) continue;
        if (ctx.trackModel) mask[idx] = 1;
        const sa = a > 1 ? 1 : a;
        fb[i4] = out[0] * sa + fb[i4] * (1 - sa);
        fb[i4 + 1] = out[1] * sa + fb[i4 + 1] * (1 - sa);
        fb[i4 + 2] = out[2] * sa + fb[i4 + 2] * (1 - sa);
        fb[i4 + 3] = sa + fb[i4 + 3] * (1 - sa);
      }
    }
  }
}


/**
 * Transform one world-space triangle, near-clip it and rasterise the resulting
 * fan.  Robust to degenerate input (non-finite coords, zero-area, zero-length
 * normals, triangles entirely behind the camera).
 */
function drawTriangle(ctx, mat, P0, P1, P2, N0, N1, N2, UV0, UV1, UV2, opaque) {
  if (!finite3(P0) || !finite3(P1) || !finite3(P2)) return;

  const geoN = normalize(cross(sub(P1, P0), sub(P2, P0)));
  if (!mat.doubleSided) {
    const cx = (P0[0] + P1[0] + P2[0]) / 3;
    const cy = (P0[1] + P1[1] + P2[1]) / 3;
    const cz = (P0[2] + P1[2] + P2[2]) / 3;
    if (dot(geoN, ctx.camera.viewDirFrom([cx, cy, cz])) <= 0) return;
  }

  const clip = ctx.clipTri;
  fillClip(clip[0], ctx.viewProj, P0, N0, UV0);
  fillClip(clip[1], ctx.viewProj, P1, N1, UV1);
  fillClip(clip[2], ctx.viewProj, P2, N2, UV2);

  const poly = clipNear([clip[0], clip[1], clip[2]], ctx.pool);
  if (poly.length < 3) return;

  const proj = ctx.proj;
  for (let i = 0; i < poly.length && i < proj.length; i++) {
    projectVertex(poly[i], ctx.camera, ctx.W, ctx.H, proj[i]);
  }
  for (let i = 1; i + 1 < poly.length && i + 1 < proj.length; i++) {
    rasterTriangle(ctx, proj[0], proj[i], proj[i + 1], mat, geoN, opaque);
  }
}

/** Fill a clip vertex from a world position / normal / uv. */
function fillClip(v, viewProj, p, n, uv) {
  const [cx, cy, cz, cw] = transformPoint(viewProj, p);
  v.cx = cx; v.cy = cy; v.cz = cz; v.cw = cw;
  v.wx = p[0]; v.wy = p[1]; v.wz = p[2];
  v.nx = n ? n[0] : 0; v.ny = n ? n[1] : 1; v.nz = n ? n[2] : 0;
  v.u = uv ? uv[0] : 0; v.v = uv ? uv[1] : 0;
}

/** @param {number[]} p */
const finite3 = (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);

/**
 * Fetch + draw one indexed triangle of a mesh.
 */
function emitTriangle(ctx, mesh, mat, a, b, c, opaque) {
  const P = mesh.positions;
  const Nrm = mesh.normals;
  const UVs = mesh.uvs;
  const pa = ctx.p0, pb = ctx.p1, pc = ctx.p2;
  pa[0] = P[a * 3]; pa[1] = P[a * 3 + 1]; pa[2] = P[a * 3 + 2];
  pb[0] = P[b * 3]; pb[1] = P[b * 3 + 1]; pb[2] = P[b * 3 + 2];
  pc[0] = P[c * 3]; pc[1] = P[c * 3 + 1]; pc[2] = P[c * 3 + 2];
  const na = Nrm ? [Nrm[a * 3], Nrm[a * 3 + 1], Nrm[a * 3 + 2]] : null;
  const nb = Nrm ? [Nrm[b * 3], Nrm[b * 3 + 1], Nrm[b * 3 + 2]] : null;
  const nc = Nrm ? [Nrm[c * 3], Nrm[c * 3 + 1], Nrm[c * 3 + 2]] : null;
  const ua = UVs ? [UVs[a * 2], UVs[a * 2 + 1]] : null;
  const ub = UVs ? [UVs[b * 2], UVs[b * 2 + 1]] : null;
  const uc = UVs ? [UVs[c * 2], UVs[c * 2 + 1]] : null;
  drawTriangle(ctx, mat, pa, pb, pc, na, nb, nc, ua, ub, uc, opaque);
}

/** Draw every triangle of a mesh in one pass. */
function drawMesh(ctx, mesh, mat, opaque) {
  const idx = mesh.indices;
  if (!mesh.positions || !idx || idx.length < 3) return;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    emitTriangle(ctx, mesh, mat, idx[i], idx[i + 1], idx[i + 2], opaque);
  }
}

/** Box-downsample the supersampled linear framebuffer and encode to sRGB. */
function resolve(fb, W, H, outW, outH, image) {
  const data = image.data;
  for (let oy = 0; oy < outH; oy++) {
    const y0 = Math.floor((oy * H) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * H) / outH));
    for (let ox = 0; ox < outW; ox++) {
      const x0 = Math.floor((ox * W) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * W) / outW));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * W + x0) * 4;
        for (let x = x0; x < x1; x++) {
          r += fb[i]; g += fb[i + 1]; b += fb[i + 2]; a += fb[i + 3];
          n++;
          i += 4;
        }
      }
      const inv = n > 0 ? 1 / n : 0;
      const o = (oy * outW + ox) * 4;
      data[o] = linearToSrgb(clamp(r * inv, 0, 1)) * 255;
      data[o + 1] = linearToSrgb(clamp(g * inv, 0, 1)) * 255;
      data[o + 2] = linearToSrgb(clamp(b * inv, 0, 1)) * 255;
      data[o + 3] = clamp(a * inv, 0, 1) * 255;
    }
  }
  return image;
}



// ---------------------------------------------------------------------------
// scene driver
// ---------------------------------------------------------------------------

/** Collect the triangles of a transparent mesh for the sorted second pass. */
function collectTransparent(ctx, mesh, mat, list) {
  const idx = mesh.indices;
  const P = mesh.positions;
  if (!P || !idx) return;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3;
    const cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3;
    const cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
    const [, , , cw] = transformPoint(ctx.viewProj, [cx, cy, cz]);
    list.push({ mesh, mat, a, b, c, depth: cw > 0 ? cw : Infinity });
  }
}

/**
 * Render a scene to an `Image`.
 *
 * @param {any} scene `{ name?, bounds?, materials?, meshes? }` (INTERFACES.md §2)
 * @param {Map<string, import('./texture.js').Texture>} textures
 * @param {object} opts
 * @param {import('./camera.js').Camera} opts.camera camera sized to `width`/`height`
 * @param {number} [opts.width=800] output width in px
 * @param {number} [opts.height=450] output height in px
 * @param {number} [opts.ss=2] supersample factor
 * @param {boolean} [opts.ground=true] draw the ground plane
 * @param {boolean} [opts.blend=true] alpha blend transparent materials
 * @param {number} [opts.groundSize] ground half extent, metres
 * @returns {{image: import('../../src/core/image.js').Image, stats: object}}
 */
export function renderScene(scene, textures, opts = {}) {
  const ss = Math.max(1, Math.round(opts.ss ?? 2));
  const outW = Math.max(1, Math.round(opts.width ?? 800));
  const outH = Math.max(1, Math.round(opts.height ?? 450));
  const W = outW * ss;
  const H = outH * ss;
  const camera = opts.camera;
  if (!camera) throw new Error('renderScene: opts.camera is required');
  camera.width = W;
  camera.height = H;
  camera.aspect = W / H;
  camera.update();

  const { materials, unresolved } = compileMaterials(scene?.materials ?? [], textures);

  const fb = new Float32Array(W * H * 4);
  const depth = new Float32Array(W * H).fill(Infinity);
  fillSky(fb, W, H);

  const ctx = {
    fb, depth, W, H, camera,
    viewProj: camera.viewProj,
    rendered: 0,
    mask: new Uint8Array(W * H),
    tmp: new Float32Array(4),
    shadeNormal: [0, 0, 0],
    shadePos: [0, 0, 0],
    clipTri: [makeClipVertex(), makeClipVertex(), makeClipVertex()],
    pool: [],
    proj: [{}, {}, {}, {}],
    p0: [0, 0, 0], p1: [0, 0, 0], p2: [0, 0, 0],
    trackModel: false,
    modelBounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  };

  const stats = { meshes: 0, triangles: 0, renderedTriangles: 0, transparentTriangles: 0, unresolved };

  if (opts.ground !== false && scene?.bounds) {
    const g = makeGroundPlane(scene.bounds, opts);
    ctx.trackModel = false;
    drawMesh(ctx, g.mesh, g.material, true);
  }

  const blend = opts.blend !== false;
  const transparent = [];
  for (const mesh of scene?.meshes ?? []) {
    stats.meshes++;
    stats.triangles += (mesh.indices?.length ?? 0) / 3;
    const mat = materials[mesh.material] ?? FALLBACK_MATERIAL;
    ctx.trackModel = true;
    if (blend && mat.transparent) collectTransparent(ctx, mesh, mat, transparent);
    else drawMesh(ctx, mesh, mat, true);
  }

  if (transparent.length) {
    transparent.sort((a, b) => b.depth - a.depth);
    for (const t of transparent) emitTriangle(ctx, t.mesh, t.mat, t.a, t.b, t.c, false);
  }
  stats.transparentTriangles = transparent.length;
  stats.renderedTriangles = ctx.rendered;

  // model coverage + screen bbox from the per-pixel mask
  let covered = 0, mx0 = W, my0 = H, mx1 = -1, my1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ctx.mask[y * W + x]) continue;
      covered++;
      if (x < mx0) mx0 = x;
      if (y < my0) my0 = y;
      if (x > mx1) mx1 = x;
      if (y > my1) my1 = y;
    }
  }
  stats.modelCoverage = covered / (W * H);
  stats.modelScreen = mx1 < 0 ? null : {
    minX: mx0 / ss, minY: my0 / ss, maxX: mx1 / ss, maxY: my1 / ss,
  };

  const image = new Image(outW, outH);
  resolve(fb, W, H, outW, outH, image);
  stats.width = outW;
  stats.height = outH;
  stats.ss = ss;
  return { image, stats };
}

/**
 * Read a pixel from an `Image` as `[r,g,b,a]` (0..255), clamped to bounds.
 * @param {import('../../src/core/image.js').Image} image
 * @param {number} x @param {number} y
 */
export function readPixel(image, x, y) {
  const px = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const i = (py * image.width + px) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}
