/**
 * Environment helpers for the offline preview renderer: the sky gradient that
 * fills the background and a procedural asphalt ground plane with a soft
 * shadow blob under the bus.
 *
 * The ground is a real textured quad (so it gets correct perspective and depth
 * like any other geometry) — its texture is generated here, not in
 * `src/textures/`, because it is a renderer-only prop.
 */

import { Image, makeNoise2D, fbm } from '../../src/core/image.js';
import { Texture } from './texture.js';
import { srgbToLinear, linearToSrgb, clamp } from './math.js';

/** Sky colours (sRGB) converted to linear once. */
export const SKY = {
  top: [0.16, 0.34, 0.68].map(srgbToLinear),
  horizon: [0.80, 0.87, 0.94].map(srgbToLinear),
};

/**
 * Fill the framebuffer with a vertical sky gradient (linear, opaque).
 * @param {Float32Array} color RGBA linear framebuffer, row 0 = top
 * @param {number} W @param {number} H
 */
export function fillSky(color, W, H) {
  const top = SKY.top;
  const hor = SKY.horizon;
  for (let y = 0; y < H; y++) {
    const t = H > 1 ? y / (H - 1) : 0;
    const k = Math.pow(t, 1.35);
    const r = top[0] + (hor[0] - top[0]) * k;
    const g = top[1] + (hor[1] - top[1]) * k;
    const b = top[2] + (hor[2] - top[2]) * k;
    let i = y * W * 4;
    for (let x = 0; x < W; x++) {
      color[i] = r;
      color[i + 1] = g;
      color[i + 2] = b;
      color[i + 3] = 1;
      i += 4;
    }
  }
}

/**
 * Generate the asphalt + shadow-blob texture (returns an `Image`).
 * The image spans `2 * size` metres centred on the bus footprint.
 * @param {number} size half extent in metres
 * @param {number} px texture resolution
 * @returns {Image}
 */
function makeGroundImage(size, px) {
  const img = new Image(px, px, [0, 0, 0, 255]);
  const noise = makeNoise2D(23);
  const s = px / (2 * size);
  const a = 6.6; // shadow ellipse semi-axis along X (bus length)
  const b = 1.95; // shadow ellipse semi-axis along Z (bus width)
  for (let y = 0; y < px; y++) {
    const z = -size + (y + 0.5) / s;
    for (let x = 0; x < px; x++) {
      const wx = -size + (x + 0.5) / s;
      const n = fbm(noise, wx * 0.55, z * 0.55, 4, 0.5, 2);
      let v = 0.42 + (n - 0.5) * 0.16;
      const d = Math.hypot(wx / a, z / b);
      let occ = clamp(1 - (d - 0.30) / 0.95, 0, 1);
      occ = occ * occ * (3 - 2 * occ);
      v *= 1 - 0.62 * occ;
      const cr = clamp(v * 0.98, 0, 1);
      const cg = clamp(v * 1.0, 0, 1);
      const cb = clamp(v * 1.05, 0, 1);
      const i = (y * px + x) * 4;
      img.data[i] = cr * 255;
      img.data[i + 1] = cg * 255;
      img.data[i + 2] = cb * 255;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/**
 * Build the ground quad + material and its texture.
 * @param {{min:number[], max:number[]}} bounds model bounds
 * @param {{groundSize?: number}} [opts]
 * @returns {{mesh: any, material: any, texture: Texture}}
 */
export function makeGroundPlane(bounds, opts = {}) {
  const extent = Math.max(
    opts.groundSize ?? 44,
    Math.abs(bounds.min[0]) + 10,
    Math.abs(bounds.max[0]) + 10,
  );
  const G = extent;
  const px = 1024;
  const texture = new Texture(makeGroundImage(G, px), '__ground');
  // Quad with CCW winding seen from above so the geometric normal is +Y.
  const mesh = {
    name: 'preview.ground',
    material: -1,
    positions: new Float32Array([-G, 0, -G, -G, 0, G, G, 0, G, G, 0, -G]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
  const material = {
    name: 'preview.ground',
    baseColor: [1, 1, 1],
    map: texture,
    mapName: '__ground',
    emissive: [0, 0, 0],
    emissiveMap: null,
    roughness: 0.96,
    metalness: 0,
    opacity: 1,
    transparent: false,
    doubleSided: false,
    mirrorUV: false,
  };
  return { mesh, material, texture };
}

export { linearToSrgb };
