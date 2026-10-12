/**
 * A small triangle-soup mesh builder.
 *
 * Everything is emitted as flat arrays (positions / normals / uvs / indices)
 * which is exactly the format the viewer, the OBJ exporter and the software
 * preview renderer expect.  A `Part` holds the geometry of one material.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const norm = (v) => {
  const l = len(v);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
};

export class Part {
  constructor(name) {
    this.name = name;
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.indices = [];
  }

  get triangleCount() {
    return this.indices.length / 3;
  }

  /** Push one vertex, returns its index in this part. */
  vertex(p, n, uv) {
    const i = this.positions.length / 3;
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.uvs.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
    return i;
  }

  /** A triangle, counter-clockwise seen from the outside. */
  triangle(p0, p1, p2, uv0, uv1, uv2, n0, n1, n2) {
    const face = norm(cross(sub(p1, p0), sub(p2, p0)));
    const a = this.vertex(p0, n0 ?? face, uv0);
    const b = this.vertex(p1, n1 ?? n0 ?? face, uv1);
    const c = this.vertex(p2, n2 ?? n0 ?? face, uv2);
    this.indices.push(a, b, c);
    return this;
  }

  /** A quad p0-p1-p2-p3 (CCW from the outside), split into two triangles. */
  quad(p0, p1, p2, p3, uv0, uv1, uv2, uv3, normals) {
    const face = norm(cross(sub(p1, p0), sub(p3, p0)));
    const n = normals ?? [face, face, face, face];
    const a = this.vertex(p0, n[0] ?? face, uv0);
    const b = this.vertex(p1, n[1] ?? face, uv1);
    const c = this.vertex(p2, n[2] ?? face, uv2);
    const d = this.vertex(p3, n[3] ?? face, uv3);
    this.indices.push(a, b, c, a, c, d);
    return this;
  }

  /**
   * Parametric surface.  `posFn(u, v)` returns `[x, y, z]`, `uvFn(u, v, p)`
   * returns the texture coordinates, `keep(u, v, center)` may reject a quad.
   * Smooth normals are derived from the surface derivatives.
   */
  grid(nu, nv, posFn, uvFn = (u, v) => [u, v], opts = {}) {
    const { smooth = true, keep = null } = opts;
    const pts = [];
    for (let i = 0; i <= nu; i++) {
      pts[i] = [];
      for (let j = 0; j <= nv; j++) pts[i][j] = posFn(i / nu, j / nv);
    }
    const normalAt = (i, j) => {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(nu, i + 1);
      const j0 = Math.max(0, j - 1);
      const j1 = Math.min(nv, j + 1);
      const du = sub(pts[i1][j], pts[i0][j]);
      const dv = sub(pts[i][j1], pts[i][j0]);
      const n = cross(du, dv);
      return len(n) < 1e-9 ? null : norm(n);
    };
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const p00 = pts[i][j];
        const p10 = pts[i + 1][j];
        const p11 = pts[i + 1][j + 1];
        const p01 = pts[i][j + 1];
        const center = [
          (p00[0] + p10[0] + p11[0] + p01[0]) / 4,
          (p00[1] + p10[1] + p11[1] + p01[1]) / 4,
          (p00[2] + p10[2] + p11[2] + p01[2]) / 4,
        ];
        if (keep && !keep(i / nu, j / nv, center)) continue;
        const uv = (u, v, p) => uvFn(u, v, p);
        if (smooth) {
          const ns = [normalAt(i, j), normalAt(i + 1, j), normalAt(i + 1, j + 1), normalAt(i, j + 1)];
          this.quad(p00, p10, p11, p01, uv(i / nu, j / nv, p00), uv((i + 1) / nu, j / nv, p10), uv((i + 1) / nu, (j + 1) / nv, p11), uv(i / nu, (j + 1) / nv, p01), ns);
        } else {
          this.quad(p00, p10, p11, p01, uv(i / nu, j / nv, p00), uv((i + 1) / nu, j / nv, p10), uv((i + 1) / nu, (j + 1) / nv, p11), uv(i / nu, (j + 1) / nv, p01));
        }
      }
    }
    return this;
  }

  /**
   * Flat cap of a planar loop, fan triangulated from the centroid.
   * `uvFn(p)` maps a world position to UV, `flip` reverses the winding.
   */
  cap(points, uvFn = () => [0.5, 0.5], flip = false) {
    const c = [0, 0, 0];
    for (const p of points) {
      c[0] += p[0] / points.length;
      c[1] += p[1] / points.length;
      c[2] += p[2] / points.length;
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (flip) this.triangle(c, b, a, uvFn(c), uvFn(b), uvFn(a));
      else this.triangle(c, a, b, uvFn(c), uvFn(a), uvFn(b));
    }
    return this;
  }

  /**
   * Axis aligned box, flat shaded.  `faces` maps a face name ('px','nx','py',
   * 'ny','pz','nz') to a `[u0, v0, u1, v1]` rectangle in the texture (atlas
   * style); without it the face is mapped with `uvScale` texels per metre.
   */
  box(center, size, opts = {}) {
    const { uvScale = 0.5, uvOffset = [0, 0], faces = {} } = opts;
    const [cx, cy, cz] = center;
    const [sx, sy, sz] = size;
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const corner = (i, j, k) => [cx + i * hx, cy + j * hy, cz + k * hz];
    const uv = (name, a, b, spanA, spanB) => {
      const rect = faces[name];
      if (rect) return [rect[0] + a * (rect[2] - rect[0]), rect[1] + b * (rect[3] - rect[1])];
      return [uvOffset[0] + a * spanA * uvScale, uvOffset[1] + b * spanB * uvScale];
    };
    // every face is wound so that cross(p1 - p0, p3 - p0) points outwards
    const face = (name, corners, uvs, spanA, spanB) => {
      const p = corners.map(([i, j, k]) => corner(i, j, k));
      const t = uvs.map(([a, b]) => uv(name, a, b, spanA, spanB));
      this.quad(p[0], p[1], p[2], p[3], t[0], t[1], t[2], t[3]);
    };
    face('px', [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sz, sy);
    face('nx', [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sz, sy);
    face('py', [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sx, sz);
    face('ny', [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sx, sz);
    face('pz', [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sx, sy);
    face('nz', [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], [[0, 0], [1, 0], [1, 1], [0, 1]], sx, sy);
    return this;
  }

  /**
   * Cylinder band around `axis` ('x' | 'y' | 'z'), `from`/`to` are offsets along
   * that axis relative to `center`, `radius` is a number or a function of t.
   */
  cylinderBand(center, axis, from, to, radius, segments, uvFn = (a, b) => [a, b], opts = {}) {
    const { smooth = true, keep = null } = opts;
    const ax = { x: 0, y: 1, z: 2 }[axis];
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    const rad = typeof radius === 'function' ? radius : () => radius;
    const point = (t, angT) => {
      const ang = angT * Math.PI * 2;
      const r = rad(t);
      const p = [0, 0, 0];
      p[ax] = from + (to - from) * t;
      p[a1] = r * Math.cos(ang);
      p[a2] = r * Math.sin(ang);
      return [p[0] + center[0], p[1] + center[1], p[2] + center[2]];
    };
    return this.grid(segments, 1, (u, v) => point(v, u), uvFn, { smooth, keep });
  }

  /** Annulus (ring) perpendicular to `axis`, centred at `center`. */
  annulus(center, axis, pos, innerRadius, outerRadius, segments, uvFn = (u, v) => [u, v], opts = {}) {
    const { flip = false, smooth = false } = opts;
    if (innerRadius <= 1e-6) return this.disc(center, axis, pos, outerRadius, segments, uvFn, { flip, smooth });
    const ax = { x: 0, y: 1, z: 2 }[axis];
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    const at = (radius, angT) => {
      const ang = angT * Math.PI * 2 * (flip ? -1 : 1);
      const p = [0, 0, 0];
      p[ax] = pos;
      p[a1] = radius * Math.cos(ang);
      p[a2] = radius * Math.sin(ang);
      return [p[0] + center[0], p[1] + center[1], p[2] + center[2]];
    };
    return this.grid(segments, 1, (u, v) => at(innerRadius + (outerRadius - innerRadius) * v, u), uvFn, { smooth });
  }

  /** Filled disc perpendicular to `axis` (fan from the centre, no slivers). */
  disc(center, axis, pos, radius, segments, uvFn = (u, v) => [u, v], opts = {}) {
    const { flip = false } = opts;
    const ax = { x: 0, y: 1, z: 2 }[axis];
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    const at = (angT) => {
      const ang = angT * Math.PI * 2 * (flip ? -1 : 1);
      const p = [0, 0, 0];
      p[ax] = pos;
      p[a1] = radius * Math.cos(ang);
      p[a2] = radius * Math.sin(ang);
      return [p[0] + center[0], p[1] + center[1], p[2] + center[2]];
    };
    const centre = [center[0], center[1], center[2]];
    centre[ax] += pos;
    for (let i = 0; i < segments; i++) {
      const a = at(i / segments);
      const b = at((i + 1) / segments);
      const uvA = uvFn(i / segments, 0, a);
      const uvB = uvFn((i + 1) / segments, 0, b);
      const uvC = uvFn((i + 0.5) / segments, 1, centre);
      if (flip) this.triangle(centre, b, a, uvC, uvB, uvA);
      else this.triangle(centre, a, b, uvC, uvA, uvB);
    }
    return this;
  }

  /** Ribbon: a loop of points extruded along `dir` (wheel arch surrounds). */
  ribbon(loop, extrude, uvFn = (t, v) => [t, v]) {
    for (let i = 0; i + 1 < loop.length; i++) {
      const a = loop[i];
      const b = loop[i + 1];
      const a2 = [a[0] + extrude[0], a[1] + extrude[1], a[2] + extrude[2]];
      const b2 = [b[0] + extrude[0], b[1] + extrude[1], b[2] + extrude[2]];
      const t0 = i / (loop.length - 1);
      const t1 = (i + 1) / (loop.length - 1);
      this.quad(a, b, b2, a2, uvFn(t0, 0), uvFn(t1, 0), uvFn(t1, 1), uvFn(t0, 1));
    }
    return this;
  }


  /** Mirror a copy of this part across z = 0 (winding is flipped). */
  mirrorZ(name = this.name) {
    const out = new Part(name);
    for (let i = 0; i < this.indices.length; i += 3) {
      const tri = [this.indices[i], this.indices[i + 1], this.indices[i + 2]];
      for (const vi of [tri[2], tri[1], tri[0]]) {
        out.vertex(
          [this.positions[vi * 3], this.positions[vi * 3 + 1], -this.positions[vi * 3 + 2]],
          [this.normals[vi * 3], this.normals[vi * 3 + 1], -this.normals[vi * 3 + 2]],
          [this.uvs[vi * 2], this.uvs[vi * 2 + 1]],
        );
      }
      const n = out.positions.length / 3;
      out.indices.push(n - 3, n - 2, n - 1);
    }
    return out;
  }

  /** Translate / uniformly scale / rotate about Y, in place. */
  transform({ translate = [0, 0, 0], scale = 1, rotateY = 0 } = {}) {
    const c = Math.cos(rotateY);
    const s = Math.sin(rotateY);
    for (let i = 0; i < this.positions.length; i += 3) {
      const x = this.positions[i] * scale;
      const y = this.positions[i + 1] * scale;
      const z = this.positions[i + 2] * scale;
      this.positions[i] = x * c + z * s + translate[0];
      this.positions[i + 1] = y + translate[1];
      this.positions[i + 2] = -x * s + z * c + translate[2];
      const mx = this.normals[i];
      const my = this.normals[i + 1];
      const mz = this.normals[i + 2];
      this.normals[i] = mx * c + mz * s;
      this.normals[i + 1] = my;
      this.normals[i + 2] = -mx * s + mz * c;
    }
    return this;
  }

  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.positions.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], this.positions[i + c]);
        max[c] = Math.max(max[c], this.positions[i + c]);
      }
    }
    return { min, max };
  }

  /** Validate + compact into the plain mesh object of INTERFACES.md §2. */
  toMesh(material) {
    const positions = new Float32Array(this.positions);
    const normals = new Float32Array(this.normals);
    const uvs = new Float32Array(this.uvs);
    for (let i = 0; i < normals.length; i += 3) {
      const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      if (!Number.isFinite(l) || l < 1e-6) {
        normals[i] = 0;
        normals[i + 1] = 1;
        normals[i + 2] = 0;
      } else {
        normals[i] /= l;
        normals[i + 1] /= l;
        normals[i + 2] /= l;
      }
    }
    for (let i = 0; i < uvs.length; i++) uvs[i] = Math.min(1, Math.max(0, uvs[i]));
    return {
      name: this.name,
      material,
      positions,
      normals,
      uvs,
      indices: new Uint32Array(this.indices),
    };
  }
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export { cross, sub, norm, len };

