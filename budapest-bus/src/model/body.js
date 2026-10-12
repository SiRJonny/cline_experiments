/**
 * The body shell.
 *
 * The shell is one lofted surface: a plan view outline (rounded rectangle) is
 * evaluated at a stack of heights, and quads between consecutive rings are
 * routed to materials by region — blue paint below the belt line, black band +
 * glass in the window band, light grey on the roof.  The lower side panels are
 * built separately (`panels.js`) so they can have wheel arch cut outs.
 *
 * UV conventions are per material, derived from world position:
 *   sides  u = (x + 6) / 12            v = (y - skirt) / (belt - skirt)
 *   front  u = (1.02 - z) / 2.04       v = (y - skirt) / (windshieldBase - skirt)
 *   rear   u = (z + 1.02) / 2.04       v = (y - skirt) / (windshieldBase - skirt)
 *   roof   u = (x + 6) / 12            v = (z + 1.2) / 2.4
 */

import { SPEC, widthAt, frontAt, rearAt, cornerAt, bayAt } from './spec.js';

const CORNER_STEPS = 4;
const FRONT_STEPS = 8;
const REAR_STEPS = 8;

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Ring of plan view points for one height.  Returns `{p, seg}` entries. */
export function ring(y, stations, inset = null) {
  const w = widthAt(y) - (inset?.w ?? 0);
  const xr = rearAt(y) + (inset?.x ?? 0);
  const xf = frontAt(y) - (inset?.x ?? 0);
  const rc = Math.max(0.05, cornerAt(y) - (inset?.rc ?? 0));
  const out = [];
  const push = (x, z, seg) => {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.p[0] - x) < 1e-6 && Math.abs(prev.p[2] - z) < 1e-6) return;
    out.push({ p: [x, y, z], seg });
  };
  const x0 = xr + rc;
  const x1 = xf - rc;
  const cx = (v) => Math.min(Math.max(v, x0), x1);
  // In the roof region the plan outline shrinks quickly towards the ends, so
  // the fixed bay stations would collapse onto each other and produce slivers.
  // There we resample the side uniformly instead.
  let sideSamples = stations;
  if (y > 2.6 || x1 - x0 < 3) {
    sideSamples = [];
    const n = 12;
    for (let i = 0; i <= n; i++) sideSamples.push(x0 + ((x1 - x0) * i) / n);
  } else {
    sideSamples = stations.filter((v) => v > x0 - 0.04 && v < x1 + 0.04);
  }
  // right hand side, rear -> front
  for (const s of sideSamples) push(cx(s), w, 'sideR');
  // front right corner
  for (let i = 1; i <= CORNER_STEPS; i++) {
    const a = (1 - i / CORNER_STEPS) * (Math.PI / 2);
    push(xf - rc + rc * Math.cos(a), w - rc + rc * Math.sin(a), 'front');
  }
  // front face, +z -> -z
  for (let i = 1; i < FRONT_STEPS; i++) push(xf, w - rc - (2 * (w - rc) * i) / FRONT_STEPS, 'front');
  // front left corner
  for (let i = 0; i <= CORNER_STEPS; i++) {
    const a = -((i / CORNER_STEPS) * Math.PI) / 2;
    push(xf - rc + rc * Math.cos(a), -(w - rc) + rc * Math.sin(a), 'front');
  }
  // left hand side, front -> rear
  for (let i = sideSamples.length - 1; i >= 0; i--) push(cx(sideSamples[i]), -w, 'sideL');
  // rear left corner
  for (let i = 1; i <= CORNER_STEPS; i++) {
    const a = -Math.PI / 2 - (i / CORNER_STEPS) * (Math.PI / 2);
    push(xr + rc + rc * Math.cos(a), -(w - rc) + rc * Math.sin(a), 'rear');
  }
  // rear face, -z -> +z
  for (let i = 1; i < REAR_STEPS; i++) push(xr, -(w - rc) + (2 * (w - rc) * i) / REAR_STEPS, 'rear');
  // rear right corner
  for (let i = 0; i <= CORNER_STEPS; i++) {
    const a = Math.PI - (i / CORNER_STEPS) * (Math.PI / 2);
    push(xr + rc + rc * Math.cos(a), w - rc + rc * Math.sin(a), 'rear');
  }
  return out;
}

/** X stations of the side panels: bay boundaries, pillars and corners. */
export function sideStations() {
  const marks = new Set([-5.95, 5.95]);
  const bays = SPEC.bays;
  for (const bay of bays) {
    marks.add(bay.x0);
    marks.add(bay.x1);
    marks.add((bay.x0 + bay.x1) / 2);
  }
  for (let i = 0; i + 1 < bays.length; i++) marks.add((bays[i].x1 + bays[i + 1].x0) / 2);
  return [...marks].sort((a, b) => a - b);
}

/** Which material a shell quad belongs to. */
function shellMaterial(seg, cx, cy, cz) {
  const cornerRegion = Math.abs(cz) > widthAt(cy) - cornerAt(cy) - 0.01;
  if (seg === 'sideR' || seg === 'sideL') {
    if (cy < SPEC.belt + 0.06) return 'band';
    if (cy < SPEC.glassTop) {
      const side = seg === 'sideR' ? 1 : -1;
      const bay = bayAt(cx);
      return bay && !(side > 0 && bay.door) ? 'glass' : 'band';
    }
    if (cy < SPEC.roofEdge + 0.06) return 'band';
    return 'paint.roof';
  }
  if (seg === 'front') {
    if (cy < SPEC.windshieldBase) return 'paint.front';
    if (cy < SPEC.glassTop) return cornerRegion ? 'band' : 'glass.front';
    if (cy < SPEC.roofEdge + 0.06) return 'band';
    return 'paint.roof';
  }
  if (cy < SPEC.windshieldBase) return 'paint.rear';
  if (cy < SPEC.rearWindowTop) return cornerRegion ? 'band' : 'glass.front';
  if (cy < SPEC.roofEdge + 0.06) return 'band';
  return 'paint.roof';
}

/** Per material UV mapping from a world position. */
export function uvFor(key, p, seg) {
  const [x, y, z] = p;
  switch (key) {
    case 'paint.sideR':
    case 'paint.sideL':
      return [clamp01((x + 6) / 12), clamp01((y - SPEC.skirt) / (SPEC.belt - SPEC.skirt))];
    case 'paint.front':
      return [clamp01((1.02 - z) / 2.04), clamp01((y - SPEC.skirt) / (SPEC.windshieldBase - SPEC.skirt))];
    case 'paint.rear':
      return [clamp01((z + 1.02) / 2.04), clamp01((y - SPEC.skirt) / (SPEC.windshieldBase - SPEC.skirt))];
    case 'paint.roof':
      return [clamp01((x + 6) / 12), clamp01((z + 1.2) / 2.4)];
    case 'glass':
    case 'glass.front':
    case 'band': {
      const u = seg === 'sideR' || seg === 'sideL' ? (x + 6) / 12 : (z + 1.2) / 2.4;
      return [clamp01(u), clamp01((y - SPEC.belt) / (SPEC.glassTop - SPEC.belt + 0.03))];
    }
    default:
      return [clamp01((x + 6) / 12), clamp01((y - SPEC.skirt) / (SPEC.roofCrown - SPEC.skirt))];
  }
}

/**
 * Loft the shell.
 *
 * @param {(key: string, name: string) => import('./builder.js').Part} part
 * @param {object} o `rows` (list of heights), `segments` (ring segments to
 *   emit), `reverse` (flip the winding, used for the interior liner),
 *   `materialFor` override, `stations` override, `names` per material mesh name.
 */
export function buildShell(part, o = {}) {
  const rows = o.rows ?? SPEC.rows.map((r) => r.y);
  const segments = o.segments ?? ['sideR', 'sideL', 'front', 'rear'];
  const reverse = o.reverse ?? false;
  const stations = o.stations ?? sideStations();
  const rings = rows.map((y) => ring(o.clampY ? Math.min(y, o.clampY) : y, stations, o.inset));
  const materialFor = o.materialFor ?? shellMaterial;
  for (let j = 0; j + 1 < rows.length; j++) {
    const a = rings[j];
    const b = rings[j + 1];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      // never bridge two different ring segments (that would span the bus)
      if (a[i].seg !== a[i2].seg || !segments.includes(a[i].seg)) continue;
      const p0 = a[i].p;
      const p1 = a[i2].p;
      const p2 = b[i2].p;
      const p3 = b[i].p;
      const area = Math.abs((p1[0] - p0[0]) * (p3[1] - p0[1]) - (p3[0] - p0[0]) * (p1[1] - p0[1])) + Math.abs(p1[2] - p0[2]);
      if (area < 1e-9) continue;
      const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4;
      const cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      const cz = (p0[2] + p1[2] + p2[2] + p3[2]) / 4;
      const key = materialFor(a[i].seg, cx, cy, cz);
      if (!key) continue;
      const target = part(key, o.names?.[key] ?? key);
      const uv = (p) => uvFor(key, p, a[i].seg);
      if (reverse) target.quad(p0, p3, p2, p1, uv(p0), uv(p3), uv(p2), uv(p1));
      else target.quad(p0, p1, p2, p3, uv(p0), uv(p1), uv(p2), uv(p3));
    }
  }
  return rings;
}

/** Flat cap of a ring (roof crown, underside, interior ceiling). */
export function capRing(part, ringPoints, key, flip = false) {
  const target = part(key, key);
  const uv = (p) => uvFor(key, p, 'front');
  target.cap(ringPoints.map((r) => r.p), uv, flip);
  return target;
}

/** Rows above the belt line (the window band + roof). */
export const UPPER_ROWS = SPEC.rows.filter((r) => r.y >= SPEC.belt).map((r) => r.y);
/** Rows at or below the belt line (skirt, front and rear faces). */
export const LOWER_ROWS = SPEC.rows.filter((r) => r.y <= SPEC.belt).map((r) => r.y);

