/**
 * Lower side panels (skirt to belt line) with real wheel arch cut outs, the
 * wheel wells behind them, and the door leaves / door seals.
 *
 * The panel is a structured grid: `x` stations include the bay boundaries and a
 * dense set of samples across each wheel arch, and every column runs from the
 * arch boundary (or the skirt line) up to the belt line.  That produces a
 * smooth arch opening without any boolean geometry.
 */

import { SPEC, widthAt, frontAt, rearAt, sideGlassRanges } from './spec.js';
import { sideStations } from './body.js';

const ARCH_HALF_WIDTH = 0.73;
const ARCH_HEIGHT = 0.82;
const ARCH_EXPONENT = 0.55;
const ARCH_DEPTH = 0.3;

const AXLES = [SPEC.axleFront, SPEC.axleRear];

/** Height of the lower edge of the panel at `x` (arch boundary or skirt). */
export function archBoundary(x) {
  let y = SPEC.skirt;
  for (const ax of AXLES) {
    const t = Math.abs(x - ax) / ARCH_HALF_WIDTH;
    if (t < 1) y = Math.max(y, SPEC.skirt + ARCH_HEIGHT * Math.pow(1 - t * t, ARCH_EXPONENT));
  }
  return y;
}

/** X stations of the panel grid. */
export function panelStations() {
  const marks = new Set(sideStations());
  for (const ax of AXLES) {
    for (let k = -24; k <= 24; k++) marks.add(ax + ARCH_HALF_WIDTH * Math.sin((k / 24) * (Math.PI / 2)));
  }
  return [...marks].sort((a, b) => a - b);
}

/** The door bay that covers `x` on the given side, if any. */
function doorAt(x, side) {
  if (side < 0) return null;
  for (const bay of SPEC.bays) {
    if (bay.door && x >= bay.x0 && x <= bay.x1) return bay;
  }
  return null;
}

/** UV inside the lower side panel (u along the bus, v up). */
function panelUV(p) {
  return [(p[0] + 6) / 12, (p[1] - SPEC.skirt) / (SPEC.belt - SPEC.skirt)];
}

/** UV inside a door leaf. */
function doorUV(p, door) {
  return [(p[0] - door.x0) / (door.x1 - door.x0), (p[1] - SPEC.skirt) / (SPEC.belt - SPEC.skirt)];
}


/**
 * Build the lower panels for both sides.
 * @param {(key: string, name: string) => import('./builder.js').Part} part
 */
export function buildLowerPanels(part) {
  for (const side of [1, -1]) {
    const paint = part(side > 0 ? 'paint.sideR' : 'paint.sideL', side > 0 ? 'panel.right' : 'panel.left');
    const doorFront = part('door.front', 'door.front');
    const doorMiddle = part('door.middle', 'door.middle');
    const seal = part('rubber', 'door.seals');
    const well = part('plastic.dark', 'wheel.wells');
    const stations = panelStations();
    const zAt = (y) => side * widthAt(y);
    // fixed horizontal bands, so neighbouring columns always line up
    const rows = [];
    const bands = 8;
    for (let j = 0; j <= bands; j++) rows.push(SPEC.skirt + ((SPEC.belt - SPEC.skirt) * j) / bands);

    for (let i = 0; i + 1 < stations.length; i++) {
      const xa = stations[i];
      const xb = stations[i + 1];
      if (xb - xa < 1e-4) continue;
      const botA = archBoundary(xa);
      const botB = archBoundary(xb);
      if (Math.max(botA, botB) >= SPEC.belt - 1e-3) continue;
      for (let j = 0; j + 1 < rows.length; j++) {
        // the bottom edge of every column follows the arch curve itself, which
        // keeps the opening smooth instead of stepped
        const y0a = Math.max(rows[j], botA);
        const y0b = Math.max(rows[j], botB);
        const y1 = rows[j + 1];
        if (y1 - Math.max(y0a, y0b) < 0.025) continue; // never emit slivers
        const door = doorAt((xa + xb) / 2, side);
        const inset = door ? 0.004 : 0;
        const p0 = [xa, y0a, zAt(y0a) + inset * side];
        const p1 = [xb, y0b, zAt(y0b) + inset * side];
        const p2 = [xb, y1, zAt(y1) + inset * side];
        const p3 = [xa, y1, zAt(y1) + inset * side];
        const target = door ? (door.door === 'front' ? doorFront : doorMiddle) : paint;
        const uv = (p) => (door ? doorUV(p, door) : panelUV(p));
        // mirror the winding on the left hand side so faces stay outward
        if (side > 0) target.quad(p0, p1, p2, p3, uv(p0), uv(p1), uv(p2), uv(p3));
        else target.quad(p1, p0, p3, p2, uv(p1), uv(p0), uv(p3), uv(p2));
      }
    }

    // Wheel wells: a constant depth cavity behind the arch opening, so the
    // surfaces always face the opening and never cut through the tyre.
    for (const ax of AXLES) {
      const steps = 28;
      const backZ = side * (SPEC.halfTrack - 0.2);
      const inner = [];
      const outer = [];
      for (let k = 0; k <= steps; k++) {
        const x = ax - ARCH_HALF_WIDTH + (2 * ARCH_HALF_WIDTH * k) / steps;
        const y = archBoundary(x);
        inner.push([x, y, backZ]);
        outer.push([x, y, side * widthAt(y)]);
      }
      const axle = [ax, SPEC.wheelRadius, side * SPEC.halfTrack];
      for (let k = 0; k + 1 < inner.length; k++) {
        const [a0, a1] = [inner[k], inner[k + 1]];
        const [b0, b1] = [outer[k], outer[k + 1]];
        // pick the winding whose normal points at the wheel
        const e1 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
        const e2 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const mid = [(a0[0] + b1[0]) / 2, (a0[1] + b1[1]) / 2, (a0[2] + b1[2]) / 2];
        const toAxle = [axle[0] - mid[0], axle[1] - mid[1], axle[2] - mid[2]];
        const flip = n[0] * toAxle[0] + n[1] * toAxle[1] + n[2] * toAxle[2] < 0;
        const uv = (t, v) => [t, v];
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        if (flip) well.quad(a0, b0, b1, a1, uv(t0, 0), uv(t0, 1), uv(t1, 1), uv(t1, 0));
        else well.quad(b0, a0, a1, b1, uv(t0, 1), uv(t0, 0), uv(t1, 0), uv(t1, 1));
      }
      // back wall closing the cavity, facing outwards
      // the loop already begins and ends on the skirt line, so the polygon
      // closes along the bottom edge on its own
      well.cap(inner, () => [0.5, 0.5], side < 0);
    }

    // Door seals: thin dark bands filling the step around each door leaf.
    if (side > 0) {
      for (const bay of SPEC.bays) {
        if (!bay.door) continue;
        for (const x of [bay.x0, bay.x1]) {
          const points = [];
          for (let k = 0; k <= 4; k++) {
            const y = SPEC.skirt + ((SPEC.belt - SPEC.skirt) * k) / 4;
            points.push([x, y, widthAt(y)]);
          }
          for (let k = 0; k + 1 < points.length; k++) {
            const a = points[k];
            const b = points[k + 1];
            seal.quad(a, b, [b[0], b[1], b[2] + 0.006], [a[0], a[1], a[2] + 0.006], [0, 0], [0, 1], [1, 1], [1, 0]);
          }
        }
        for (const y of [SPEC.skirt, SPEC.belt]) {
          const z = widthAt(y);
          seal.quad([bay.x0, y, z], [bay.x1, y, z], [bay.x1, y, z + 0.006], [bay.x0, y, z + 0.006], [0, 0], [1, 0], [1, 1], [0, 1]);
        }
      }
    }
  }
}

/** Side glass panes, slightly proud of the black band. */
export function buildSideGlass(part) {
  const glass = part('glass', 'glass.side');
  for (const side of [1, -1]) {
    for (const [x0, x1] of sideGlassRanges(side)) {
      const y0 = SPEC.belt + 0.06;
      const y1 = SPEC.glassTop - 0.01;
      const z = (y) => side * (widthAt(y) + 0.003);
      const p0 = [x0 + 0.01, y0, z(y0)];
      const p1 = [x1 - 0.01, y0, z(y0)];
      const p2 = [x1 - 0.01, y1, z(y1)];
      const p3 = [x0 + 0.01, y1, z(y1)];
      const uv = (p) => [(p[0] + 6) / 12, (p[1] - SPEC.belt) / (SPEC.glassTop - SPEC.belt + 0.03)];
      if (side > 0) glass.quad(p0, p1, p2, p3, uv(p0), uv(p1), uv(p2), uv(p3));
      else glass.quad(p1, p0, p3, p2, uv(p1), uv(p0), uv(p3), uv(p2));
    }
  }
}

/** Flat underside pan (dark), inset in z so it clears the wheels. */
export function buildUnderside(part) {
  const target = part('paint.plain', 'body.under');
  const y = SPEC.skirt - 0.01;
  const w = 0.86;
  const pts = [
    [rearAt(y) + 0.4, y, -w],
    [frontAt(y) - 0.4, y, -w],
    [frontAt(y) - 0.4, y, w],
    [rearAt(y) + 0.4, y, w],
  ];
  target.cap(pts, () => [0.5, 0.5], true);
  return target;
}

