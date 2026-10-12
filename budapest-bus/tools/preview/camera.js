/**
 * Perspective camera + named view presets for the offline preview renderer.
 *
 * Presets are defined by a *direction* (from the model towards the eye) and a
 * framing factor relative to the model radius, so they auto-frame any model
 * without hard-coded world positions.  `--yaw/--pitch/--dist/--target`
 * overrides are applied on top of whatever the preset produced.
 *
 * Coordinate system (see docs/INTERFACES.md): +X forward, +Y up, +Z right.
 */

import {
  mat4Perspective,
  mat4LookAt,
  mat4Multiply,
  transformPoint,
  sub,
  length,
  normalize,
  clamp,
} from './math.js';

/** @typedef {import('./math.js').Vec3} Vec3 */

const DEG = Math.PI / 180;

/**
 * @typedef {object} Preset
 * @property {Vec3} dir direction from the model centre towards the eye
 * @property {number} fov vertical field of view, degrees
 * @property {number} frame eye distance as a multiple of the model radius
 * @property {Vec3} up camera up vector
 */

/** @type {Record<string, Preset>} */
export const CAMERA_PRESETS = {
  // 3/4 front, from above and to the door (right) side — the "hero" shot.
  hero: { dir: [0.74, 0.40, 0.84], fov: 32, frame: 2.15, up: [0, 1, 0] },
  side: { dir: [0.0, 0.14, 1.0], fov: 30, frame: 2.35, up: [0, 1, 0] },
  front: { dir: [1.0, 0.10, 0.0], fov: 34, frame: 2.05, up: [0, 1, 0] },
  rear: { dir: [-1.0, 0.12, 0.05], fov: 34, frame: 2.05, up: [0, 1, 0] },
  // looking almost straight down; -X points "up" the image so the nose is up.
  top: { dir: [0.02, 1.0, 0.02], fov: 30, frame: 4.3, up: [-1, 0, 0] },
  // close-up of the front right wheel arch (handled specially, see below).
  wheel: { dir: [0.62, 0.24, 0.74], fov: 30, frame: 0.0, up: [0, 1, 0] },
};

export const PRESET_NAMES = Object.keys(CAMERA_PRESETS);

/**
 * @typedef {object} CameraOptions
 * @property {string} [preset]  one of {@link CAMERA_PRESETS}
 * @property {number} [width]   framebuffer width in px (render resolution)
 * @property {number} [height]  framebuffer height in px
 * @property {number} [fov]     vertical fov in degrees (overrides preset)
 * @property {number} [yaw]     azimuth override, degrees
 * @property {number} [pitch]   elevation override, degrees
 * @property {number} [dist]    eye distance override, metres
 * @property {Vec3}   [target]  look-at override
 * @property {number} [near]
 * @property {number} [far]
 */

export class Camera {
  /**
   * @param {CameraOptions} [opts]
   */
  constructor(opts = {}) {
    this.width = opts.width ?? 800;
    this.height = opts.height ?? 450;
    this.near = opts.near ?? 0.05;
    this.far = opts.far ?? 2000;
    this.eye = [0, 0, 10];
    this.target = [0, 0, 0];
    this.up = [0, 1, 0];
    this.fovY = (opts.fov ?? 32) * DEG;
    this.aspect = this.width / this.height;
    this.update();
  }

  /** Recompute the view / projection / view-projection matrices. */
  update() {
    this.view = mat4LookAt(this.eye, this.target, this.up);
    this.projection = mat4Perspective(this.fovY, this.aspect, this.near, this.far);
    this.viewProj = mat4Multiply(this.projection, this.view);
  }

  /**
   * Project a world point to framebuffer pixels.
   * @param {Vec3} p
   * @returns {{x:number, y:number, depth:number, w:number, visible:boolean}}
   *   `depth` is the positive view distance (smaller = closer), `visible` is
   *   false when the point is behind the camera or outside the frame.
   */
  project(p) {
    const [cx, cy, cz, cw] = transformPoint(this.viewProj, p);
    if (!(cw > 1e-6)) return { x: -1, y: -1, depth: Infinity, w: cw, visible: false };
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    const x = (ndcX * 0.5 + 0.5) * this.width;
    const y = (0.5 - ndcY * 0.5) * this.height;
    const visible = x >= 0 && x < this.width && y >= 0 && y < this.height && cw > this.near;
    return { x, y, depth: cw, w: cw, visible };
  }

  /** Unit vector from a world point towards the eye (for specular). */
  viewDirFrom(p) {
    return normalize(sub(this.eye, p));
  }
}


/**
 * Build a camera for a named preset, framed against the model bounds.
 *
 * @param {string} name preset name
 * @param {{min: Vec3, max: Vec3}} bounds model bounds
 * @param {CameraOptions} [opts] overrides (`width`, `height`, `fov`, `yaw`,
 *   `pitch`, `dist`, `target`, `near`, `far`)
 * @returns {Camera}
 */
export function cameraFromPreset(name, bounds, opts = {}) {
  const preset = CAMERA_PRESETS[name] ?? CAMERA_PRESETS.hero;
  const size = sub(bounds.max, bounds.min);
  const radius = Math.max(0.5, 0.5 * length(size));
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];

  let target = center.slice();
  let dist;
  if (name === 'wheel') {
    // Front right wheel arch: a fixed offset behind the nose, on the +Z side.
    target = [bounds.max[0] - 2.6, bounds.min[1] + 0.55, 1.05];
    dist = Math.max(3.0, radius * 0.62);
  } else {
    dist = radius * preset.frame;
  }

  // --- explicit overrides -------------------------------------------------
  if (opts.target) target = opts.target.slice();
  let eye = [
    target[0] + preset.dir[0] * dist,
    target[1] + preset.dir[1] * dist,
    target[2] + preset.dir[2] * dist,
  ];

  const hasOrbit = opts.yaw !== undefined || opts.pitch !== undefined || opts.dist !== undefined;
  if (hasOrbit) {
    const base = normalize(sub(eye, target));
    const curYaw = Math.atan2(base[0], base[2]); // around +Y
    const curPitch = Math.asin(clamp(base[1], -1, 1));
    const yaw = opts.yaw !== undefined ? opts.yaw * DEG : curYaw;
    const pitch = opts.pitch !== undefined ? opts.pitch * DEG : curPitch;
    const r = opts.dist !== undefined ? opts.dist : length(sub(eye, target));
    const cp = Math.cos(pitch);
    eye = [
      target[0] + r * cp * Math.sin(yaw),
      target[1] + r * Math.sin(pitch),
      target[2] + r * cp * Math.cos(yaw),
    ];
  }

  const cam = new Camera({
    width: opts.width ?? 800,
    height: opts.height ?? 450,
    near: opts.near ?? Math.max(0.02, radius * 0.005),
    far: opts.far ?? Math.max(200, radius * 60),
  });
  cam.eye = eye;
  cam.target = target;
  cam.up = (preset.up ?? [0, 1, 0]).slice();
  cam.fovY = (opts.fov !== undefined ? opts.fov : preset.fov) * DEG;
  cam.update();
  return cam;
}
