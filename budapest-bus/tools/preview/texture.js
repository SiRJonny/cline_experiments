/**
 * Texture cache + bilinear sampler for the offline preview renderer.
 *
 * `buildTextures()` (src/textures/index.js) returns `Record<string, Image>`
 * where every `Image` is sRGB, top-down, straight alpha.  For shading we want
 * linear light, so each image is converted once into a `Float32Array` of
 * linear RGBA.  Sampling follows `Image.sample()`: GL UV convention, `v = 0`
 * is the BOTTOM row.
 *
 * @typedef {import('../../src/core/image.js').Image} Image
 */

import { srgbToLinear, clamp } from './math.js';

export class Texture {
  /**
   * @param {Image} image
   * @param {string} [name]
   */
  constructor(image, name = '') {
    this.name = name;
    this.width = image.width;
    this.height = image.height;
    const n = image.width * image.height;
    const src = image.data;
    const dst = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      dst[i * 4 + 0] = srgbToLinear(src[i * 4 + 0] / 255);
      dst[i * 4 + 1] = srgbToLinear(src[i * 4 + 1] / 255);
      dst[i * 4 + 2] = srgbToLinear(src[i * 4 + 2] / 255);
      dst[i * 4 + 3] = src[i * 4 + 3] / 255;
    }
    this.data = dst;
  }

  /**
   * Bilinear sample, GL UVs (`v = 0` is the bottom row), out-of-range clamped.
   * @param {number} u @param {number} v
   * @param {Float32Array} out length >= 4, receives linear `[r,g,b,a]`
   * @returns {Float32Array}
   */
  sample(u, v, out) {
    const fx = clamp(u, 0, 1) * (this.width - 1);
    const fy = (1 - clamp(v, 0, 1)) * (this.height - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y1 = Math.min(y0 + 1, this.height - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const d = this.data;
    const w = this.width;
    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;
    for (let c = 0; c < 4; c++) {
      const a = d[i00 + c] + (d[i10 + c] - d[i00 + c]) * tx;
      const b = d[i01 + c] + (d[i11 + c] - d[i01 + c]) * tx;
      out[c] = a + (b - a) * ty;
    }
    return out;
  }
}

/**
 * Convert a `Record<string, Image>` into a `Map<string, Texture>`.
 * @param {Record<string, Image>} images
 * @returns {Map<string, Texture>}
 */
export function buildTextureCache(images) {
  const cache = new Map();
  if (!images) return cache;
  for (const [name, image] of Object.entries(images)) {
    if (image && typeof image.sample === 'function') cache.set(name, new Texture(image, name));
  }
  return cache;
}
