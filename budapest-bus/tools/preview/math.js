/**
 * Minimal vector / matrix helpers for the offline preview renderer.
 *
 * Matrices are stored column-major in a `Float32Array(16)` — the exact same
 * layout WebGL / three.js use (`m[col * 4 + row]`), so the matrices can be
 * compared against the browser viewer if ever needed.
 *
 * There are no dependencies: this file must run unchanged in Node and in the
 * browser.
 */

/** @typedef {number[]} Vec3 */

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {Vec3} a @param {number} s @returns {Vec3} */
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** @param {Vec3} a @param {Vec3} b @returns {number} */
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** @param {Vec3} a @returns {number} */
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
/** @param {Vec3} a @returns {Vec3} */
export function normalize(a) {
  const l = length(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}
/** @param {Vec3} a @param {Vec3} b @param {number} t @returns {Vec3} */
export const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** @returns {Float32Array} identity matrix */
export function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/**
 * Matrix product `a * b` (column-major, `b` applied first).
 * @param {Float32Array} a @param {Float32Array} b @returns {Float32Array}
 */
export function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

/**
 * Right-handed perspective projection (looks down -Z, NDC z in [-1, 1]).
 * @param {number} fovY vertical field of view, radians
 * @param {number} aspect width / height
 * @param {number} near @param {number} far
 * @returns {Float32Array}
 */
export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

/**
 * View matrix looking from `eye` at `target`.
 * @param {Vec3} eye @param {Vec3} target @param {Vec3} up
 * @returns {Float32Array}
 */
export function mat4LookAt(eye, target, up) {
  const z = normalize(sub(eye, target));
  let x = cross(up, z);
  if (length(x) < 1e-9) x = cross([0, 0, 1], z); // up parallel to view dir
  x = normalize(x);
  const y = cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0;
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0;
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0;
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  m[15] = 1;
  return m;
}

/**
 * Transform a homogeneous point by a matrix.
 * @param {Float32Array} m @param {Vec3} p @returns {[number,number,number,number]}
 */
export function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

/**
 * Transform a direction (ignores translation).
 * @param {Float32Array} m @param {Vec3} p @returns {Vec3}
 */
export function transformDirection(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

/** sRGB (0..1) -> linear (0..1). */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear (0..1) -> sRGB (0..1). */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
