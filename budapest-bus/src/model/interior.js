/**
 * Interior: the liner (the surface you see through the glass), the floor, the
 * seats, the handrails and the driver's area.  Only visible through the tinted
 * glass, but it makes the windows read as real glazing instead of black holes.
 */

import { SPEC } from './spec.js';
import { buildShell, ring } from './body.js';
import { sideStations } from './body.js';

const CEILING = 2.8;
const WALL_INSET = { w: 0.075, x: 0.09, rc: 0.05 };
const LINER_ROWS = [0.46, 0.9, 1.4, 1.9, 2.35, 2.6, 2.75, CEILING];

const interiorUV = (p) => [(p[0] + 6) / 12, (p[1] - SPEC.skirt) / (CEILING - SPEC.skirt)];
const floorUV = (p) => [(p[0] + 6) / 12, (p[2] + 1.2) / 2.4];

/** @param {(key: string, name: string) => import('./builder.js').Part} part */
export function buildInterior(part) {
  const wall = part('interior.wall', 'interior.liner');
  const stations = sideStations().filter((x) => x > -5.9 && x < 5.9);
  // liner: the shell turned inside out, inset a little
  buildShell(
    (key, name) => part(key === 'interior.wall' ? 'interior.wall' : key, name),
    {
      rows: LINER_ROWS,
      inset: WALL_INSET,
      clampY: CEILING,
      reverse: true,
      stations,
      materialFor: () => 'interior.wall',
      names: { 'interior.wall': 'interior.liner' },
    },
  );
  // ceiling cap and floor
  const ceilingRing = ring(CEILING, stations, WALL_INSET);
  part('interior.wall', 'interior.liner').cap(ceilingRing.map((r) => r.p), interiorUV, true);
  const floorRing = ring(0.46, stations, { w: 0.11, x: 0.16, rc: 0.06 });
  part('interior.floor', 'interior.floor').cap(floorRing.map((r) => r.p), floorUV, false);

  buildSeats(part);
  buildRails(part);
  buildDriverArea(part);

  // rear engine box and the step well at the doors
  const dark = part('plastic.dark', 'interior.dark');
  dark.box([-5.1, 1.05, 0], [0.9, 1.2, 2.1]);
  for (const bay of SPEC.bays) {
    if (!bay.door) continue;
    dark.box([(bay.x0 + bay.x1) / 2, 0.3, 1.05], [bay.x1 - bay.x0, 0.28, 0.4]);
  }
  return wall;
}

/** Two rows of seats (2 + 2) plus a bench at the very back. */
function buildSeats(part) {
  const seat = part('interior.seat', 'interior.seats');
  const rows = SPEC.seatRows;
  for (const x of rows) {
    for (const side of [1, -1]) {
      const cz = side * 0.76;
      seat.box([x, 0.86, cz], [0.5, 0.12, 0.46], { uvScale: 1 });
      seat.box([x - 0.22, 1.12, cz], [0.09, 0.5, 0.46], { uvScale: 1 });
      seat.box([x, 0.66, cz], [0.42, 0.3, 0.4], { uvScale: 1 });
    }
  }
  // rear bench, right across the back
  seat.box([-4.5, 0.9, 0], [0.5, 0.14, 1.9], { uvScale: 1 });
  seat.box([-4.72, 1.16, 0], [0.09, 0.5, 1.9], { uvScale: 1 });
}

/** Vertical poles at the doors and rails along the ceiling. */
function buildRails(part) {
  const rail = part('metal', 'interior.rails');
  const poles = [];
  for (const bay of SPEC.bays) {
    if (!bay.door) continue;
    poles.push(bay.x0 + 0.06, bay.x1 - 0.06);
  }
  poles.push(2.8, 0.2, -2.3, -4.0);
  for (const x of poles) {
    for (const side of [1, -1]) {
      rail.cylinderBand([x, 0.46, side * 0.52], 'y', 0, 2.34, 0.02, 8, (u, v) => [u, v], { smooth: true });
    }
  }
  for (const side of [1, -1]) {
    rail.cylinderBand([0, 2.3, side * 0.5], 'x', -5.4, 5.3, 0.018, 8, (u, v) => [u, v], { smooth: true });
    rail.cylinderBand([0, 2.55, side * 0.72], 'x', -3.4, 3.0, 0.018, 8, (u, v) => [u, v], { smooth: true });
  }
}

/** Driver's cab: partition, dashboard, seat and steering wheel. */
function buildDriverArea(part) {
  const wall = part('interior.wall', 'interior.liner');
  const dark = part('plastic.dark', 'interior.dark');
  const seat = part('interior.seat', 'interior.seats');
  const metal = part('metal', 'interior.rails');
  // partition behind the driver, on the left hand side of the bus
  wall.box([4.5, 1.3, -0.72], [0.06, 1.75, 1.02]);
  // dashboard
  dark.box([5.45, 0.95, -0.7], [0.5, 0.36, 1.15]);
  // driver seat
  seat.box([4.85, 0.82, -0.72], [0.5, 0.12, 0.5], { uvScale: 1 });
  seat.box([4.63, 1.16, -0.72], [0.1, 0.62, 0.5], { uvScale: 1 });
  // steering wheel
  const cx = 5.05;
  const cy = 1.08;
  metal.cylinderBand([cx, cy, -0.72], 'x', 0, 0.05, 0.03, 8, (u, v) => [u, v], { smooth: true });
  metal.annulus([cx + 0.05, cy, -0.72], 'x', 0, 0.16, 0.19, 20, (u, v) => [u, v], { flip: false });
}
