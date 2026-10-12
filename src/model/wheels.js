/**
 * Wheels: tyre, rim and brake disc.  Built in local space (axis along Z) and
 * then moved to the axle position, with the front wheels turned slightly.
 *
 * The tyre sidewall UVs are flipped on the left hand side of the bus so the
 * lettering moulded into the rubber stays readable from outside.
 */

import { SPEC } from './spec.js';
import { Part } from './builder.js';

const TYRE_RADIUS = SPEC.wheelRadius;
const TYRE_HALF_WIDTH = SPEC.wheelWidth / 2;
const RIM_RADIUS = 0.325;
const SEGMENTS = 28;

/**
 * @param {(key: string, name: string) => Part} part
 */
export function buildWheels(part) {
  for (const side of [1, -1]) {
    const tread = part('rubber.tread', 'wheels.tread');
    const sidewall = part('rubber.sidewall', 'wheels.sidewall');
    const rim = part('metal.rim', 'wheels.rim');
    const brake = part('plastic.dark', 'wheels.brake');
    for (const axle of [SPEC.axleFront, SPEC.axleRear]) {
      const local = {
        tread: new Part('local.tread'),
        sidewall: new Part('local.sidewall'),
        rim: new Part('local.rim'),
        brake: new Part('local.brake'),
      };
      buildOneWheel(local, side);
      const steer = axle === SPEC.axleFront ? -SPEC.steer * side : 0;
      const translate = [axle, TYRE_RADIUS, side * SPEC.halfTrack];
      for (const key of Object.keys(local)) local[key].transform({ translate, rotateY: steer });
      appendPart(tread, local.tread);
      appendPart(sidewall, local.sidewall);
      appendPart(rim, local.rim);
      appendPart(brake, local.brake);
    }
  }
}

/** Copy the contents of `src` into `dst` (keeps indices valid). */
function appendPart(dst, src) {
  const offset = dst.positions.length / 3;
  for (const v of src.positions) dst.positions.push(v);
  for (const v of src.normals) dst.normals.push(v);
  for (const v of src.uvs) dst.uvs.push(v);
  for (const i of src.indices) dst.indices.push(i + offset);
}

/** One wheel in local space: centre at the origin, axis along +Z. */
function buildOneWheel(out, side) {
  const flip = side < 0;
  const outerZ = TYRE_HALF_WIDTH;
  const innerZ = -TYRE_HALF_WIDTH;
  // tread
  out.tread.cylinderBand([0, 0, 0], 'z', innerZ, outerZ, TYRE_RADIUS, SEGMENTS, (u, v) => [u, v], { smooth: true });
  // sidewalls, annulus between rim and tread
  const sidewall = (z, outward, uv) =>
    out.sidewall.annulus([0, 0, 0], 'z', z, RIM_RADIUS, TYRE_RADIUS, SEGMENTS, uv, { flip: outward > 0 });
  sidewall(outerZ, 1, (u, v) => [flip ? 1 - u : u, v]);
  sidewall(innerZ, -1, (u, v) => [u, v]);
  // rim dish, rim lip and hub cap
  const dishZ = outerZ - 0.075;
  out.rim.annulus([0, 0, 0], 'z', dishZ, 0.1, RIM_RADIUS, SEGMENTS, (u, v) => [u, 0.5 + (v - 0.5) * 0.5], { flip: true });
  out.rim.cylinderBand([0, 0, 0], 'z', dishZ, dishZ + 0.02, RIM_RADIUS, SEGMENTS, (u, v) => [u, 0.5 + v * 0.05], { smooth: true });
  out.rim.cylinderBand([0, 0, 0], 'z', dishZ, dishZ + 0.018, (t) => 0.075 - t * 0.012, SEGMENTS, (u, v) => [u, 0.5 + v * 0.2], { smooth: true });
  out.rim.disc([0, 0, 0], 'z', dishZ + 0.018, 0.063, SEGMENTS, (u, v) => [u, 0.62 + v * 0.1], { flip: false });
  // brake disc behind the rim
  out.brake.annulus([0, 0, 0], 'z', dishZ - 0.02, 0, RIM_RADIUS - 0.01, SEGMENTS, () => [0.5, 0.5], { flip: true });
}
