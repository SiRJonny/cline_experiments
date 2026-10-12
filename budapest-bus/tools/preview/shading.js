/**
 * Material compilation + lighting for the offline preview renderer.
 *
 * Lighting model (all in linear space):
 *   - one key directional light (warm, slightly above/right of the front),
 *   - a cool "studio" fill from the opposite side,
 *   - a hemisphere ambient term (sky above, ground bounce below),
 *   - Cook-Torrance style specular driven by `roughness` / `metalness`,
 *   - `emissive` * `emissiveMap` added unlit (headlights, displays).
 */

import { normalize, add, dot, srgbToLinear, clamp } from './math.js';

/** @typedef {import('./texture.js').Texture} Texture */
/** @typedef {import('./math.js').Vec3} Vec3 */

/** Static light rig; `dir` points from the surface towards the light. */
export const LIGHTS = {
  key: { dir: normalize([0.42, 0.78, 0.55]), color: [1.0, 0.97, 0.92], intensity: 1.3 },
  fill: { dir: normalize([-0.55, 0.28, -0.66]), color: [0.62, 0.73, 0.92], intensity: 0.42 },
  sky: [0.55, 0.66, 0.88],
  ground: [0.20, 0.18, 0.16],
  ambient: 0.55,
};

/** @param {number[]} c @returns {Vec3} */
const lin = (c) => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];

/**
 * @typedef {object} CompiledMaterial
 * @property {string} name
 * @property {Vec3} baseColor linear albedo used when `map` is null
 * @property {Texture|null} map
 * @property {string|null} mapName
 * @property {Vec3} emissive linear emissive tint
 * @property {Texture|null} emissiveMap
 * @property {number} roughness @property {number} metalness
 * @property {number} opacity @property {boolean} transparent
 * @property {boolean} doubleSided @property {boolean} mirrorUV
 */

/**
 * Compile the raw material records of INTERFACES.md into renderer-friendly
 * records, resolving texture names against the cache.
 *
 * @param {any[]} materials
 * @param {Map<string, Texture>} cache
 * @returns {{materials: CompiledMaterial[], unresolved: string[]}}
 */
export function compileMaterials(materials, cache) {
  const unresolved = new Set();
  const compiled = (materials ?? []).map((m, i) => {
    const map = m.map ? cache.get(m.map) ?? null : null;
    if (m.map && !map) unresolved.add(m.map);
    const emissiveMap = m.emissiveMap ? cache.get(m.emissiveMap) ?? null : null;
    if (m.emissiveMap && !emissiveMap) unresolved.add(m.emissiveMap);
    return {
      name: m.name ?? `material_${i}`,
      baseColor: lin(m.baseColor ?? [1, 1, 1]),
      map,
      mapName: m.map ?? null,
      emissive: lin(m.emissive ?? [0, 0, 0]),
      emissiveMap,
      roughness: clamp(m.roughness ?? 0.6, 0.02, 1),
      metalness: clamp(m.metalness ?? 0, 0, 1),
      opacity: clamp(m.opacity ?? 1, 0, 1),
      transparent: !!m.transparent,
      doubleSided: !!m.doubleSided,
      mirrorUV: !!m.mirrorUV,
    };
  });
  return { materials: compiled, unresolved: [...unresolved] };
}

/** Fallback material used when a mesh references a missing material index. */
export const FALLBACK_MATERIAL = {
  name: 'fallback',
  baseColor: [0.8, 0.0, 0.8],
  map: null,
  mapName: null,
  emissive: [0, 0, 0],
  emissiveMap: null,
  roughness: 0.6,
  metalness: 0,
  opacity: 1,
  transparent: false,
  doubleSided: true,
  mirrorUV: false,
};

const scratch = new Float32Array(4);


/**
 * Evaluate the full shading model for one surface point.
 *
 * @param {CompiledMaterial} mat
 * @param {Vec3} N world-space normal (unit)
 * @param {Vec3} V unit vector from the point towards the eye
 * @param {Vec3} P world position (unused by the current rig, kept for future)
 * @param {number} u @param {number} v texture coordinates
 * @param {Float32Array} out length >= 4, receives linear `[r,g,b,a]`
 * @returns {Float32Array} `out`
 */
export function shadeSurface(mat, N, V, P, u, v, out) {
  const su = mat.mirrorUV ? 1 - u : u;
  const sv = v;

  let ar = mat.baseColor[0];
  let ag = mat.baseColor[1];
  let ab = mat.baseColor[2];
  let alpha = mat.opacity;
  if (mat.map) {
    const s = mat.map.sample(su, sv, scratch);
    ar *= s[0];
    ag *= s[1];
    ab *= s[2];
    alpha *= s[3];
  }

  const nrm = normalize(N);
  const ny = nrm[1];

  // ---- key + fill diffuse ------------------------------------------------
  let r = 0, g = 0, b = 0;
  const key = LIGHTS.key;
  const fill = LIGHTS.fill;
  const kd = Math.max(0, dot(nrm, key.dir)) * key.intensity;
  const fd = Math.max(0, dot(nrm, fill.dir)) * fill.intensity;
  r += ar * (kd * key.color[0] + fd * fill.color[0]);
  g += ag * (kd * key.color[1] + fd * fill.color[1]);
  b += ab * (kd * key.color[2] + fd * fill.color[2]);

  // ---- hemisphere ambient ------------------------------------------------
  const hemi = (ny * 0.5 + 0.5) * LIGHTS.ambient;
  r += ar * (LIGHTS.ground[0] + (LIGHTS.sky[0] - LIGHTS.ground[0]) * hemi);
  g += ag * (LIGHTS.ground[1] + (LIGHTS.sky[1] - LIGHTS.ground[1]) * hemi);
  b += ab * (LIGHTS.ground[2] + (LIGHTS.sky[2] - LIGHTS.ground[2]) * hemi);

  // ---- specular (Cook-Torrance / GGX) ------------------------------------
  const f0r = 0.04 + (ar - 0.04) * mat.metalness;
  const f0g = 0.04 + (ag - 0.04) * mat.metalness;
  const f0b = 0.04 + (ab - 0.04) * mat.metalness;
  const a = mat.roughness * mat.roughness;
  const a2 = a * a;
  const k = ((mat.roughness + 1) * (mat.roughness + 1)) / 8;
  const ndv = Math.max(dot(nrm, V), 1e-4);

  const addSpec = (L, color, intensity) => {
    const ndl = dot(nrm, L);
    if (ndl <= 0) return;
    const H = normalize(add(L, V));
    const ndh = Math.max(dot(nrm, H), 0);
    const vdh = Math.max(dot(V, H), 0);
    const d = ndh * ndh * (a2 - 1) + 1;
    const D = a2 / (Math.PI * d * d + 1e-6);
    const G = (ndl / (ndl * (1 - k) + k)) * (ndv / (ndv * (1 - k) + k));
    const fw = Math.pow(1 - vdh, 5);
    const spec = ((D * G * intensity) / (4 * ndl * ndv + 1e-4)) * ndl;
    r += (f0r + (1 - f0r) * fw) * spec * color[0];
    g += (f0g + (1 - f0g) * fw) * spec * color[1];
    b += (f0b + (1 - f0b) * fw) * spec * color[2];
  };
  addSpec(key.dir, key.color, key.intensity);
  addSpec(fill.dir, fill.color, fill.intensity * 0.6);

  // ---- emissive (unlit) --------------------------------------------------
  let er = mat.emissive[0];
  let eg = mat.emissive[1];
  let eb = mat.emissive[2];
  if (mat.emissiveMap) {
    const s = mat.emissiveMap.sample(su, sv, scratch);
    er *= s[0];
    eg *= s[1];
    eb *= s[2];
  }
  r += er; g += eg; b += eb;

  out[0] = r;
  out[1] = g;
  out[2] = b;
  out[3] = alpha;
  return out;
}
