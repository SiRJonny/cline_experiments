/**
 * Exterior fittings: bumpers, lights, mirrors, wipers, number plates, the LED
 * destination displays and the roof equipment (air conditioning, hatches).
 *
 * Everything hugs the body surface through `frontSurfaceX` / `rearSurfaceX`, so
 * the parts follow the rounded front and rear corners.
 */

import { SPEC, frontSurfaceX, rearSurfaceX, widthAt, DESTINATION } from './spec.js';

/** A panel that follows the front surface (`z` and `y` are world coordinates). */
function frontPanel(part, { y0, y1, z0, z1, offset, uv, nx = 5, ny = 3, material }) {
  const target = part(material.key, material.name);
  const zSpan = z1 - z0;
  const ySpan = y1 - y0;
  const xs = (z, y) => frontSurfaceX(z, y) + offset;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const za = z0 + (zSpan * i) / nx;
      const zb = z0 + (zSpan * (i + 1)) / nx;
      const ya = y0 + (ySpan * j) / ny;
      const yb = y0 + (ySpan * (j + 1)) / ny;
      const p0 = [xs(za, ya), ya, za];
      const p1 = [xs(zb, ya), ya, zb];
      const p2 = [xs(zb, yb), yb, zb];
      const p3 = [xs(za, yb), yb, za];
      target.quad(p1, p0, p3, p2, uv(p1), uv(p0), uv(p3), uv(p2));
    }
  }
  return target;
}

/** Same for the rear face (winding and UVs mirrored in z). */
function rearPanel(part, { y0, y1, z0, z1, offset, uv, nx = 5, ny = 3, material }) {
  const target = part(material.key, material.name);
  const zSpan = z1 - z0;
  const ySpan = y1 - y0;
  const xs = (z, y) => rearSurfaceX(z, y) - offset;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const za = z0 + (zSpan * i) / nx;
      const zb = z0 + (zSpan * (i + 1)) / nx;
      const ya = y0 + (ySpan * j) / ny;
      const yb = y0 + (ySpan * (j + 1)) / ny;
      const p0 = [xs(za, ya), ya, za];
      const p1 = [xs(zb, ya), ya, zb];
      const p2 = [xs(zb, yb), yb, zb];
      const p3 = [xs(za, yb), yb, za];
      target.quad(p0, p1, p2, p3, uv(p0), uv(p1), uv(p2), uv(p3));
    }
  }
  return target;
}

const rectUV = (z0, z1, y0, y1, u0 = 0, v0 = 0, u1 = 1, v1 = 1) => (p) => [
  u0 + ((p[2] - z0) / (z1 - z0)) * (u1 - u0),
  v0 + ((p[1] - y0) / (y1 - y0)) * (v1 - v0),
];

const DARK = { key: 'plastic.dark', name: 'trim.dark' };

/** Front of the bus: bumper, lamps, grille, plate, display, wipers. */
export function buildFront(part) {
  // bumper, follows the front corner radius
  frontPanel(part, { y0: SPEC.skirt, y1: 0.8, z0: -1.24, z1: 1.24, offset: 0.075, nx: 12, ny: 3, material: DARK, uv: rectUV(-1.24, 1.24, SPEC.skirt, 0.8) });
  // bumper top edge, closes the step
  const trim = part('plastic.dark', 'trim.dark');
  const zs = [-1.24, -0.9, -0.4, 0, 0.4, 0.9, 1.24];
  for (let i = 0; i + 1 < zs.length; i++) {
    const xa = frontSurfaceX(zs[i], 0.8);
    const xb = frontSurfaceX(zs[i + 1], 0.8);
    trim.quad([xa, 0.8, zs[i]], [xb, 0.8, zs[i + 1]], [xb + 0.075, 0.8, zs[i + 1]], [xa + 0.075, 0.8, zs[i]], [0, 0], [1, 0], [1, 1], [0, 1]);
  }

  // head lamps, one cluster each side
  for (const side of [1, -1]) {
    const z0 = side > 0 ? 0.5 : -1.14;
    const z1 = side > 0 ? 1.14 : -0.5;
    frontPanel(part, { y0: 0.84, y1: 1.32, z0, z1, offset: 0.006, nx: 6, ny: 3, material: DARK, uv: () => [0.5, 0.5] });
    frontPanel(part, { y0: 0.87, y1: 1.29, z0: z0 + 0.03, z1: z1 - 0.03, offset: 0.022, nx: 6, ny: 3, material: { key: 'lamp.head', name: 'lamp.head' }, uv: rectUV(z1, z0, 0.87, 1.29) });
  }

  // grille: three slats under the windshield
  for (let i = 0; i < 3; i++) {
    const y = 1.42 + i * 0.09;
    for (let k = 0; k + 1 < [-0.6, -0.3, 0, 0.3, 0.6].length; k++) {
      const za = [-0.6, -0.3, 0, 0.3, 0.6][k];
      const zb = [-0.6, -0.3, 0, 0.3, 0.6][k + 1];
      const xa = frontSurfaceX(za, y) + 0.03;
      const xb = frontSurfaceX(zb, y) + 0.03;
      trim.quad([xb, y, zb], [xa, y, za], [xa, y + 0.05, za], [xb, y + 0.05, zb], [1, 0], [0, 0], [0, 1], [1, 1]);
    }
  }

  // number plate on the bumper
  frontPanel(part, { y0: 0.44, y1: 0.6, z0: -0.28, z1: 0.28, offset: 0.078, nx: 2, ny: 1, material: { key: 'plate.front', name: 'plate.front' }, uv: rectUV(0.28, -0.28, 0.44, 0.6) });

  // destination display, a recessed box above the windshield
  const displayY0 = SPEC.glassTop + 0.07;
  const displayY1 = displayY0 + 0.3;
  frontPanel(part, { y0: displayY0, y1: displayY1, z0: -0.86, z1: 0.86, offset: 0.02, nx: 2, ny: 1, material: DARK, uv: () => [0.5, 0.5] });
  frontPanel(part, { y0: displayY0 + 0.035, y1: displayY1 - 0.035, z0: -0.8, z1: 0.8, offset: 0.03, nx: 2, ny: 1, material: { key: 'led.front', name: 'led.front' }, uv: rectUV(0.8, -0.8, displayY0, displayY1) });

  // wipers, parked at the bottom of the windshield
  for (const side of [1, -1]) {
    const z0 = side * 0.16;
    const z1 = side * 0.92;
    const y = 2.0;
    trim.quad([frontSurfaceX(z1, y) + 0.015, y, z1], [frontSurfaceX(z0, y) + 0.015, y, z0], [frontSurfaceX(z0, y) + 0.03, y + 0.035, z0], [frontSurfaceX(z1, y) + 0.03, y + 0.035, z1], [1, 0], [0, 0], [0, 1], [1, 1]);
  }
}


/** Rear of the bus: bumper, tail lamps, engine louvres, plate, LED box. */
export function buildRear(part) {
  const trim = part('plastic.dark', 'trim.dark');
  rearPanel(part, { y0: SPEC.skirt, y1: 0.78, z0: -1.24, z1: 1.24, offset: 0.075, nx: 12, ny: 3, material: DARK, uv: rectUV(-1.24, 1.24, SPEC.skirt, 0.78) });
  const zs = [-1.24, -0.9, -0.4, 0, 0.4, 0.9, 1.24];
  for (let i = 0; i + 1 < zs.length; i++) {
    const xa = rearSurfaceX(zs[i], 0.78);
    const xb = rearSurfaceX(zs[i + 1], 0.78);
    trim.quad([xa, 0.78, zs[i]], [xa - 0.075, 0.78, zs[i]], [xb - 0.075, 0.78, zs[i + 1]], [xb, 0.78, zs[i + 1]], [0, 0], [1, 0], [1, 1], [0, 1]);
  }

  // tail lamps
  for (const side of [1, -1]) {
    const z0 = side > 0 ? 0.62 : -1.16;
    const z1 = side > 0 ? 1.16 : -0.62;
    rearPanel(part, { y0: 0.86, y1: 1.36, z0, z1, offset: 0.006, nx: 6, ny: 3, material: DARK, uv: () => [0.5, 0.5] });
    rearPanel(part, { y0: 0.89, y1: 1.33, z0: z0 + 0.03, z1: z1 - 0.03, offset: 0.022, nx: 6, ny: 3, material: { key: 'lamp.tail', name: 'lamp.tail' }, uv: rectUV(z0, z1, 0.89, 1.33) });
  }

  // engine compartment louvres, a recessed panel with slats
  // negative offset pushes the panel inboard, i.e. recesses it behind the slats
  rearPanel(part, { y0: 1.05, y1: 1.72, z0: -0.78, z1: 0.78, offset: -0.045, nx: 5, ny: 2, material: DARK, uv: () => [0.5, 0.5] });
  for (let i = 0; i < 7; i++) {
    const y = 1.08 + i * 0.09;
    const za = -0.75;
    const zb = 0.75;
    const xa = rearSurfaceX(za, y) - 0.005;
    const xb = rearSurfaceX(zb, y) - 0.005;
    trim.quad([xa, y + 0.045, za], [xa, y, za], [xb, y, zb], [xb, y + 0.045, zb], [0, 0], [1, 0], [1, 1], [0, 1]);
  }

  // number plate on the bumper
  rearPanel(part, { y0: 0.44, y1: 0.6, z0: -0.28, z1: 0.28, offset: 0.078, nx: 2, ny: 1, material: { key: 'plate.rear', name: 'plate.rear' }, uv: rectUV(-0.28, 0.28, 0.44, 0.6) });

  // LED route box inside the rear window
  rearPanel(part, { y0: 2.12, y1: 2.44, z0: -0.72, z1: 0.72, offset: -0.06, nx: 4, ny: 1, material: { key: 'led.rear', name: 'led.rear' }, uv: rectUV(-0.72, 0.72, 2.12, 2.44) });

  // exhaust stub
  const metal = part('metal', 'rear.exhaust');
  metal.cylinderBand([-6.02, 0.42, -0.62], 'x', 0, 0.12, 0.055, 10, (u, v) => [u, v], { smooth: true });
}

/** Roof equipment: air conditioning unit, hatches, antenna, vents. */
export function buildRoof(part) {
  const trim = part('plastic.dark', 'roof.unit');
  const metal = part('metal', 'roof.metal');
  // air conditioning unit
  trim.box([-0.6, SPEC.roofCrown + 0.11, 0], [3.1, 0.22, 1.5], { faces: { py: [0, 0, 1, 1] } });
  trim.box([-0.6, SPEC.roofCrown + 0.24, 0], [2.6, 0.06, 1.2]);
  // roof hatches
  for (const x of [2.5, -3.9]) {
    trim.box([x, SPEC.roofCrown + 0.035, 0], [0.72, 0.07, 0.72]);
  }
  // rear engine air intake
  trim.box([-5.0, SPEC.roofCrown + 0.06, 0], [0.9, 0.12, 1.2]);
  // antenna + a small beacon
  metal.cylinderBand([4.9, SPEC.roofCrown, 0.55], 'y', 0, 0.42, (t) => 0.02 - t * 0.012, 6, (u, v) => [u, v], { smooth: true });
  metal.cylinderBand([5.2, SPEC.roofCrown, -0.5], 'y', 0, 0.06, 0.05, 8, (u, v) => [u, v], { smooth: true });
}



/**
 * A thin square section tube from `a` to `b` (used for the mirror stalks).
 * @param {object} target part to append to
 */
function stalk(target, a, b, radius = 0.028, steps = 6) {
  const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const f = [dir[0] / len, dir[1] / len, dir[2] / len];
  // any vector not parallel to f gives us a stable frame
  const up = Math.abs(f[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  const rl = Math.hypot(r[0], r[1], r[2]) || 1;
  const rx = [r[0] / rl, r[1] / rl, r[2] / rl];
  const uy = [f[1] * rx[2] - f[2] * rx[1], f[2] * rx[0] - f[0] * rx[2], f[0] * rx[1] - f[1] * rx[0]];
  const at = (t, sgn) => [
    a[0] + dir[0] * t + (rx[0] + uy[0] * sgn) * radius,
    a[1] + dir[1] * t + (rx[1] + uy[1] * sgn) * radius,
    a[2] + dir[2] * t + (rx[2] + uy[2] * sgn) * radius,
  ];
  const uv = (t, v) => [t, v];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    for (const sgn of [1, -1]) {
      const a0 = at(t0, sgn);
      const a1 = at(t1, sgn);
      const b0 = [a0[0] - uy[0] * radius * 2 * sgn, a0[1] - uy[1] * radius * 2 * sgn, a0[2] - uy[2] * radius * 2 * sgn];
      const b1 = [a1[0] - uy[0] * radius * 2 * sgn, a1[1] - uy[1] * radius * 2 * sgn, a1[2] - uy[2] * radius * 2 * sgn];
      if (sgn > 0) target.quad(a0, b0, b1, a1, uv(t0, 0), uv(t0, 1), uv(t1, 1), uv(t1, 0));
      else target.quad(b0, a0, a1, b1, uv(t0, 1), uv(t0, 0), uv(t1, 0), uv(t1, 1));
    }
  }
}

/** Mirrors: a stalk plus a main and a wide angle mirror head on each side. */
export function buildMirrors(part) {
  const trim = part('plastic.dark', 'mirrors');
  const glass = part('glass', 'mirrors.glass');
  for (const side of [1, -1]) {
    const anchor = [frontSurfaceX(side * 1.12, 2.3) - 0.02, 2.3, side * 1.16];
    const tip = [anchor[0] + 0.22, 2.4, side * 1.56];
    stalk(trim, anchor, tip, 0.03);
    // main mirror head
    const head = [tip[0] + 0.06, 2.4, tip[2] + side * 0.05];
    trim.box([head[0], head[1], head[2]], [0.1, 0.5, 0.22]);
    glass.quad(
      [head[0] - 0.051, head[1] - 0.23, head[2] - 0.1],
      [head[0] - 0.051, head[1] - 0.23, head[2] + 0.1],
      [head[0] - 0.051, head[1] + 0.23, head[2] + 0.1],
      [head[0] - 0.051, head[1] + 0.23, head[2] - 0.1],
      [0, 0], [1, 0], [1, 1], [0, 1],
    );
    // wide angle mirror under the head
    const wide = [head[0] - 0.03, 2.02, head[2]];
    stalk(trim, [head[0] - 0.02, head[1] - 0.24, head[2]], wide, 0.022, 3);
    trim.box([wide[0], wide[1], wide[2]], [0.08, 0.2, 0.18]);
    glass.quad(
      [wide[0] - 0.041, wide[1] - 0.085, wide[2] - 0.08],
      [wide[0] - 0.041, wide[1] - 0.085, wide[2] + 0.08],
      [wide[0] - 0.041, wide[1] + 0.085, wide[2] + 0.08],
      [wide[0] - 0.041, wide[1] + 0.085, wide[2] - 0.08],
      [0, 0], [1, 0], [1, 1], [0, 1],
    );
  }
}

/**
 * Small LED route number panels on the right hand side, mounted just inside
 * the window so they read through the tinted glass.
 */
export function buildSideDisplays(part) {
  const housing = part('plastic.dark', 'trim.dark');
  const led = part('led.side', 'led.side');
  const x0 = 3.55;
  const x1 = 4.05;
  const y0 = 2.06;
  const y1 = 2.34;
  const zAt = (y) => widthAt(y);
  // housing plus the LED face, both slightly inside the glazing
  for (const [zOff, target] of [[-0.02, housing], [-0.035, led]]) {
    const z0 = zAt(y0) + zOff;
    const z1 = zAt(y1) + zOff;
    target.quad(
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1],
      [0, 0], [1, 0], [1, 1], [0, 1],
    );
  }
}
