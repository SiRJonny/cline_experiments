/**
 * Hard numbers for the bus.
 *
 * The model is a 12 m low-floor city bus in BKV (Budapest) blue livery, close
 * in proportions to the Volvo 7900 / Mercedes Citaro that BKV runs on routes
 * such as 5, 7, 8E, 105 and 200E.  All units are metres, the origin is on the
 * road surface under the middle of the bus, +X is forward, +Y up, +Z to the
 * right hand side of the bus (the side the doors are on, right hand traffic).
 */

/** Half width / plan outline of the body at a given height. */
const ROWS = [
  // y (height)  w (half width)  xr (rear)  xf (front)  rc (plan corner radius)
  { y: 0.34, w: 1.185, xr: -5.78, xf: 5.78, rc: 0.34 }, // bottom of the skirt
  { y: 0.45, w: 1.225, xr: -5.85, xf: 5.85, rc: 0.33 },
  { y: 0.62, w: 1.262, xr: -5.9, xf: 5.9, rc: 0.32 },
  { y: 0.9, w: 1.272, xr: -5.93, xf: 5.93, rc: 0.32 },
  { y: 1.35, w: 1.275, xr: -5.95, xf: 5.95, rc: 0.32 },
  { y: 1.85, w: 1.275, xr: -5.95, xf: 5.95, rc: 0.32 }, // belt line
  { y: 1.95, w: 1.275, xr: -5.95, xf: 5.95, rc: 0.34 },
  { y: 2.25, w: 1.275, xr: -5.95, xf: 5.94, rc: 0.38 },
  { y: 2.53, w: 1.273, xr: -5.93, xf: 5.83, rc: 0.42 }, // top of the glass
  { y: 2.56, w: 1.272, xr: -5.92, xf: 5.78, rc: 0.44 }, // roof edge, start of the curve
  { y: 2.68, w: 1.255, xr: -5.88, xf: 5.6, rc: 0.5 },
  { y: 2.8, w: 1.225, xr: -5.82, xf: 5.32, rc: 0.58 },
  { y: 2.9, w: 1.16, xr: -5.72, xf: 5.0, rc: 0.66 },
  { y: 2.97, w: 1.03, xr: -5.58, xf: 4.62, rc: 0.72 },
  { y: 3.02, w: 0.855, xr: -5.4, xf: 4.3, rc: 0.7 }, // roof crown / cap edge
];

/**
 * Side bays, front to rear.  `door` marks the bays that are doors on the right
 * hand side (BKV buses only have doors on the right, right hand traffic).
 */
const BAYS = [
  { x0: 4.55, x1: 5.55, door: 'front' }, // door 1, single leaf, ahead of the front axle
  { x0: 2.85, x1: 4.4 },
  { x0: 1.15, x1: 2.7 },
  { x0: -0.55, x1: 1.0 },
  { x0: -2.05, x1: -0.7, door: 'middle' }, // door 2, double leaf
  { x0: -3.75, x1: -2.2 },
  { x0: -5.45, x1: -3.9 },
];

export const SPEC = {
  name: 'BKV city bus 12 m (procedural)',
  rows: ROWS,
  bays: BAYS,

  /** heights */
  skirt: 0.34,
  belt: 1.85,
  glassTop: 2.53,
  roofEdge: 2.56,
  roofCrown: 3.02,
  floor: 0.42,
  ceiling: 2.86,

  /** axles and wheels */
  axleFront: 3.35,
  axleRear: -2.9,
  wheelRadius: 0.52,
  wheelWidth: 0.3,
  halfTrack: 1.06,
  archRadius: 0.6,
  steer: 0.1, // front wheels turned by ~6 degrees

  /** the front / rear faces */
  frontX: 5.95,
  rearX: -5.95,
  windshieldBase: 1.95,
  rearWindowTop: 2.53,

  /** interior */
  seatRows: [2.6, 1.3, 0.0, -1.3, -2.6, -3.9],
  aisleHalfWidth: 0.45,
  seatWidth: 0.44,

  /** livery colours (0..1 linear-ish sRGB values for materials without a map) */
  colors: {
    blue: [0.055, 0.17, 0.47],
    blueDark: [0.03, 0.1, 0.3],
    lightBlue: [0.28, 0.55, 0.85],
    grey: [0.72, 0.74, 0.76],
    darkGrey: [0.12, 0.13, 0.14],
    black: [0.05, 0.05, 0.055],
    chrome: [0.72, 0.74, 0.78],
  },

  /** texture names used by the materials (kept in one place for the tools) */
  textures: [
    'bodySideR', 'bodySideL', 'bodyFront', 'bodyRear', 'roof', 'doorFront', 'doorMiddle',
    'glass', 'band', 'tire', 'rim', 'headlight', 'taillight', 'destination', 'destinationSide',
    'destinationRear', 'plateFront', 'plateRear', 'floor', 'seat', 'plasticDark', 'metal', 'rubber',
  ],
};

/** Plan outline half width at a height, interpolated between the rows. */
export function widthAt(y) {
  return lerpRow(y, 'w');
}
/** Front x extent at a height. */
export function frontAt(y) {
  return lerpRow(y, 'xf');
}
/** Rear x extent at a height. */
export function rearAt(y) {
  return lerpRow(y, 'xr');
}
/** Plan view corner radius at a height. */
export function cornerAt(y) {
  return lerpRow(y, 'rc');
}

function lerpRow(y, key) {
  const rows = ROWS;
  if (y <= rows[0].y) return rows[0][key];
  if (y >= rows[rows.length - 1].y) return rows[rows.length - 1][key];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a[key] + (b[key] - a[key]) * t;
    }
  }
  return rows[rows.length - 1][key];
}

/** The bay that contains `x`, or null when `x` is on a pillar. */
export function bayAt(x) {
  for (const bay of BAYS) if (x >= bay.x0 && x <= bay.x1) return bay;
  return null;
}

/** Doors: `[x0, x1, kind, side]`.  Only the right hand side has doors. */
export const DOORS = BAYS.filter((b) => b.door).map((b) => ({
  x0: b.x0,
  x1: b.x1,
  kind: b.door,
  side: 1,
}));

/** Glass openings on the sides: every bay that is not a door on that side. */
export function sideGlassRanges(side) {
  const out = [];
  for (const bay of BAYS) {
    if (side > 0 && bay.door) continue; // door instead of a window
    out.push([bay.x0, bay.x1]);
  }
  return out;
}

/** Destination display content (kept here so the textures and the model agree). */
export const DESTINATION = {
  route: '200E',
  text: 'Kőbánya-Kispest M',
  rearText: 'Kőbánya-Kispest',
};

/** Number plates (Hungarian format since 2022: AB CD-123). */
export const PLATES = { front: 'LZ VB-201', rear: 'LZ VB-202' };

/**
 * X of the front surface at a given height and lateral position, taking the
 * plan view corner radius into account (so parts hug the rounded front).
 */
export function frontSurfaceX(z, y) {
  const w = widthAt(y);
  const rc = cornerAt(y);
  const xf = frontAt(y);
  const az = Math.abs(z);
  if (az <= w - rc) return xf;
  if (az >= w) return xf - rc;
  return xf - rc + Math.sqrt(Math.max(0, rc * rc - (az - (w - rc)) ** 2));
}

/** X of the rear surface at a given height and lateral position. */
export function rearSurfaceX(z, y) {
  const w = widthAt(y);
  const rc = cornerAt(y);
  const xr = rearAt(y);
  const az = Math.abs(z);
  if (az <= w - rc) return xr;
  if (az >= w) return xr + rc;
  return xr + rc - Math.sqrt(Math.max(0, rc * rc - (az - (w - rc)) ** 2));
}
