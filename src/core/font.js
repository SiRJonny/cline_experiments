/**
 * A hand-built single-stroke vector font.
 *
 * Every glyph is a list of polylines in a unit em box: `x` grows to the right,
 * `y = 0` is the baseline and `y = 1` the cap height. Lower case falls back to
 * the upper case shape (that is how bus signage / number plates look anyway).
 * Hungarian accented letters are composed from a base glyph plus an accent
 * drawn above the cap height, so "Rákospalota" and "Őrség" render correctly.
 */

const RAD = Math.PI / 180;

/** Arc polyline: centre, radii, start/end angle in degrees (CCW). */
const arc = (cx, cy, rx, ry, a0, a1, n = 14) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * RAD;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
};
const closed = (pts) => [...pts, pts[0]];
/** Stroke from explicit points. */
const s = (...pts) => pts;

const GLYPHS = {
  ' ': { w: 0.42, s: [] },
  A: { w: 0.66, s: [s([0, 0], [0.33, 1], [0.66, 0]), s([0.12, 0.34], [0.54, 0.34])] },
  B: {
    w: 0.66,
    s: [s([0, 0], [0, 1]), arc(0.02, 0.75, 0.46, 0.25, 90, -90, 10), arc(0.02, 0.25, 0.52, 0.25, 90, -90, 10)],
  },
  C: { w: 0.7, s: [arc(0.34, 0.5, 0.34, 0.5, 50, 310, 16)] },
  D: { w: 0.7, s: [s([0, 0], [0, 1]), arc(0.02, 0.5, 0.5, 0.5, 90, -90, 12)] },
  E: { w: 0.64, s: [s([0.52, 1], [0, 1], [0, 0], [0.52, 0]), s([0, 0.52], [0.38, 0.52])] },
  F: { w: 0.62, s: [s([0.52, 1], [0, 1], [0, 0]), s([0, 0.52], [0.36, 0.52])] },
  G: { w: 0.74, s: [s(...arc(0.34, 0.5, 0.34, 0.5, 40, 300, 16), [0.68, 0.05], [0.68, 0.34], [0.42, 0.34])] },
  H: { w: 0.68, s: [s([0, 0], [0, 1]), s([0.6, 0], [0.6, 1]), s([0, 0.52], [0.6, 0.52])] },
  I: { w: 0.3, s: [s([0.15, 1], [0.15, 0]), s([0, 1], [0.3, 1]), s([0, 0], [0.3, 0])] },
  J: { w: 0.58, s: [s([0.5, 1], [0.5, 0.24], ...arc(0.26, 0.24, 0.24, 0.24, 0, -180, 10).slice(1))] },
  K: { w: 0.66, s: [s([0, 0], [0, 1]), s([0.6, 1], [0.04, 0.42]), s([0.22, 0.6], [0.62, 0])] },
  L: { w: 0.6, s: [s([0, 1], [0, 0], [0.54, 0])] },
  M: { w: 0.96, s: [s([0, 0], [0, 1], [0.45, 0.34], [0.9, 1], [0.9, 0])] },
  N: { w: 0.68, s: [s([0, 0], [0, 1], [0.6, 0], [0.6, 1])] },
  O: { w: 0.74, s: [closed(arc(0.35, 0.5, 0.35, 0.5, 0, 360, 26))] },
  P: { w: 0.68, s: [s([0, 0], [0, 1]), arc(0.02, 0.74, 0.52, 0.26, 90, -90, 12)] },
  Q: { w: 0.74, s: [closed(arc(0.35, 0.5, 0.35, 0.5, 0, 360, 26)), s([0.42, 0.2], [0.7, -0.1])] },
  R: { w: 0.68, s: [s([0, 0], [0, 1]), arc(0.02, 0.74, 0.52, 0.26, 90, -90, 12), s([0.2, 0.5], [0.62, 0])] },
  S: {
    w: 0.68,
    s: [s(...arc(0.34, 0.75, 0.3, 0.25, 20, 200, 12), ...arc(0.3, 0.25, 0.3, 0.25, 19, -180, 14))],
  },
  T: { w: 0.62, s: [s([0, 1], [0.62, 1]), s([0.31, 1], [0.31, 0])] },
  U: { w: 0.7, s: [s([0, 1], [0, 0.5], ...arc(0.34, 0.5, 0.34, 0.5, 180, 360, 14).slice(1), [0.68, 1])] },
  V: { w: 0.66, s: [s([0, 1], [0.33, 0], [0.66, 1])] },
  W: { w: 0.98, s: [s([0, 1], [0.24, 0], [0.48, 0.68], [0.72, 0], [0.96, 1])] },
  X: { w: 0.66, s: [s([0, 0], [0.64, 1]), s([0, 1], [0.64, 0])] },
  Y: { w: 0.66, s: [s([0, 1], [0.33, 0.5], [0.66, 1]), s([0.33, 0.5], [0.33, 0])] },
  Z: { w: 0.66, s: [s([0, 1], [0.64, 1], [0, 0], [0.64, 0])] },
  '0': { w: 0.64, s: [closed(arc(0.32, 0.5, 0.3, 0.5, 0, 360, 24))] },
  '1': { w: 0.52, s: [s([0.08, 0.78], [0.3, 1], [0.3, 0]), s([0.02, 0], [0.46, 0])] },
  '2': { w: 0.64, s: [s(...arc(0.32, 0.74, 0.31, 0.26, 175, 15, 10), [0, 0], [0.62, 0])] },
  '3': {
    w: 0.64,
    s: [s(...arc(0.3, 0.76, 0.3, 0.24, 165, -55, 10), ...arc(0.3, 0.26, 0.3, 0.26, 85, -95, 12).slice(1))],
  },
  '4': { w: 0.64, s: [s([0.46, 1], [0, 0.28], [0.64, 0.28]), s([0.46, 1], [0.46, 0])] },
  '5': { w: 0.64, s: [s([0.58, 1], [0.08, 1], [0.08, 0.56], ...arc(0.3, 0.28, 0.3, 0.28, 95, -80, 12).slice(1))] },
  '6': {
    w: 0.64,
    s: [s(...arc(0.34, 0.52, 0.32, 0.48, 50, 185, 12), ...closed(arc(0.3, 0.26, 0.28, 0.26, 0, 360, 18)))],
  },
  '7': { w: 0.62, s: [s([0.02, 1], [0.62, 1], [0.24, 0])] },
  '8': {
    w: 0.64,
    s: [closed(arc(0.31, 0.75, 0.29, 0.25, 0, 360, 18)), closed(arc(0.32, 0.26, 0.3, 0.26, 0, 360, 18))],
  },
  '9': {
    w: 0.64,
    s: [s(...closed(arc(0.32, 0.74, 0.3, 0.26, 0, 360, 18)), ...arc(0.3, 0.48, 0.32, 0.48, 15, -130, 12))],
  },
  '.': { w: 0.28, s: [], dot: 0.075, dotY: 0.075 },
  ',': { w: 0.3, s: [s([0.16, 0.08], [0.04, -0.14])] },
  '-': { w: 0.5, s: [s([0.06, 0.42], [0.44, 0.42])] },
  '–': { w: 0.64, s: [s([0.04, 0.42], [0.6, 0.42])] },
  ':': { w: 0.28, s: [], dots: [0.075, 0.6], dot: 0.075 },
  ';': { w: 0.3, s: [s([0.16, 0.58], [0.04, 0.36])], dot: 0.075, dotY: 0.075 },
  '/': { w: 0.6, s: [s([0.02, -0.06], [0.56, 1.04])] },
  '(': { w: 0.34, s: [arc(0.46, 0.5, 0.32, 0.58, 145, 215, 12)] },
  ')': { w: 0.34, s: [arc(0.0, 0.5, 0.32, 0.58, 35, -35, 12)] },
  '!': { w: 0.26, s: [s([0.12, 0.3], [0.12, 1])], dot: 0.075, dotY: 0.075 },
  '?': { w: 0.6, s: [s(...arc(0.3, 0.74, 0.28, 0.26, 170, -20, 10), [0.3, 0.36], [0.3, 0.28])], dot: 0.075, dotY: 0.075 },
  "'": { w: 0.24, s: [s([0.1, 0.86], [0.1, 1.06])] },
  '"': { w: 0.36, s: [s([0.08, 0.86], [0.08, 1.06]), s([0.24, 0.86], [0.24, 1.06])] },
  '+': { w: 0.6, s: [s([0.06, 0.5], [0.54, 0.5]), s([0.3, 0.26], [0.3, 0.74])] },
  '*': { w: 0.6, s: [s([0.3, 0.3], [0.3, 0.9]), s([0.06, 0.42], [0.54, 0.78]), s([0.54, 0.42], [0.06, 0.78])] },
  '°': { w: 0.36, s: [closed(arc(0.18, 1.08, 0.14, 0.14, 0, 360, 14))] },
  '#': {
    w: 0.66,
    s: [s([0.16, 0], [0.24, 1]), s([0.42, 0], [0.5, 1]), s([0.02, 0.32], [0.58, 0.32]), s([0.06, 0.68], [0.62, 0.68])],
  },
};

/** Accent strokes drawn above the cap height (y = 1 ... 1.3). */
const ACCENTS = {
  acute: [s([0.1, 1.06], [0.36, 1.3])],
  doubleacute: [s([0.02, 1.06], [0.24, 1.3]), s([0.28, 1.06], [0.5, 1.3])],
  diaeresis: [s([0.1, 1.1], [0.12, 1.1]), s([0.34, 1.1], [0.36, 1.1])],
  circumflex: [s([0.06, 1.08], [0.22, 1.3], [0.38, 1.08])],
  grave: [s([0.1, 1.3], [0.36, 1.06])],
  ring: [closed(arc(0.22, 1.18, 0.11, 0.11, 0, 360, 12))],
  tilde: [s([0.04, 1.16], [0.14, 1.22], [0.26, 1.1], [0.38, 1.16])],
  cedilla: [s([0.18, -0.02], [0.18, -0.14], [0.32, -0.2])],
};

/** letter -> [base, accent] */
const COMPOSED = {
  Á: ['A', 'acute'], É: ['E', 'acute'], Í: ['I', 'acute'], Ó: ['O', 'acute'], Ú: ['U', 'acute'],
  Ö: ['O', 'diaeresis'], Ü: ['U', 'diaeresis'], Ő: ['O', 'doubleacute'], Ű: ['U', 'doubleacute'],
  Ä: ['A', 'diaeresis'], Ë: ['E', 'diaeresis'], Ï: ['I', 'diaeresis'], Ç: ['C', 'cedilla'],
  Â: ['A', 'circumflex'], Ê: ['E', 'circumflex'], Î: ['I', 'circumflex'], Ô: ['O', 'circumflex'],
  Û: ['U', 'circumflex'], À: ['A', 'grave'], Ù: ['U', 'grave'], Å: ['A', 'ring'], Ã: ['A', 'tilde'],
  Ñ: ['N', 'tilde'], Š: ['S', 'circumflex'], Ž: ['Z', 'circumflex'],
};

/** Lower case maps onto the upper case shapes. */
const LOWER = {
  a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', h: 'H', i: 'I', j: 'J', k: 'K', l: 'L',
  m: 'M', n: 'N', o: 'O', p: 'P', q: 'Q', r: 'R', s: 'S', t: 'T', u: 'U', v: 'V', w: 'W', x: 'X',
  y: 'Y', z: 'Z',
  á: 'Á', é: 'É', í: 'Í', ó: 'Ó', ö: 'Ö', ő: 'Ő', ú: 'Ú', ü: 'Ü', ű: 'Ű', ä: 'Ä', ë: 'Ë', ï: 'Ï',
  ç: 'Ç', â: 'Â', ê: 'Ê', î: 'Î', ô: 'Ô', û: 'Û', à: 'À', ù: 'Ù', å: 'Å', ã: 'Ã', ñ: 'Ñ',
  š: 'Š', ž: 'Ž',
};

/** Resolve a character to `{ width, strokes, dot, dots, dotY }` in glyph units. */
export function resolveGlyph(ch) {
  let base = GLYPHS[ch];
  let extra = null;
  if (!base) {
    if (COMPOSED[ch]) {
      const [b, accent] = COMPOSED[ch];
      base = GLYPHS[b];
      extra = ACCENTS[accent];
    } else if (LOWER[ch]) {
      return resolveGlyph(LOWER[ch]);
    } else if (typeof ch.toUpperCase === 'function' && GLYPHS[ch.toUpperCase()]) {
      return resolveGlyph(ch.toUpperCase());
    }
  }
  if (!base) base = GLYPHS['?'];
  return {
    width: base.w,
    strokes: extra ? [...base.s, ...extra] : base.s,
    dot: base.dot ?? 0,
    dots: base.dots ?? null,
    dotY: base.dotY ?? 0.08,
    accent: Boolean(extra),
  };
}

/** Total advance width of `text` in em units (multiply by the pixel size). */
export function measureEm(text, tracking = 0.06) {
  let width = 0;
  for (const ch of text) width += resolveGlyph(ch).width + tracking;
  return Math.max(0, width - tracking);
}

/**
 * Draw text with the stroke font.
 *
 * @param {import('./image.js').Image} image
 * @param {string} text
 * @param {object} o `x`, `y` (baseline, px), `size` (cap height, px), `color`,
 *   `weight` (stroke width, px), `tracking` (em), `align` ('left'|'center'|'right'),
 *   `coverage` (0..1)
 * @returns {{x:number,y:number,width:number,height:number}} the painted box
 */
export function drawText(image, text, o) {
  const { x = 0, y = 0, size = 32, color = '#ffffff', align = 'left' } = o;
  const tracking = o.tracking ?? 0.06;
  const weight = o.weight ?? size * 0.13;
  const coverage = o.coverage ?? 1;
  const total = measureEm(text, tracking) * size;
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const start = cursor;
  for (const ch of text) {
    const glyph = resolveGlyph(ch);
    for (const stroke of glyph.strokes) {
      const pts = stroke.map(([px, py]) => [cursor + px * size, y - py * size]);
      if (pts.length === 1) image.circle(pts[0][0], pts[0][1], Math.max(0.5, weight / 2), color, coverage);
      else image.polyline(pts, color, weight, coverage);
    }
    if (glyph.dots) {
      for (const dy of glyph.dots) {
        image.circle(cursor + glyph.width / 2, y - dy * size, glyph.dot * size * 0.85, color, coverage);
      }
    } else if (glyph.dot) {
      image.circle(cursor + glyph.width / 2, y - glyph.dotY * size, glyph.dot * size * 0.85, color, coverage);
    }
    cursor += (glyph.width + tracking) * size;
  }
  return { x: start, y: y - size, width: total, height: size };
}

/**
 * Render `text` into a fresh transparent image (handy for decals/logos).
 * @param {new (w:number,h:number,c?:any) => any} ImageClass
 */
export function renderTextImage(ImageClass, text, opts = {}) {
  const { size = 64, padding = 8, color = '#ffffff', weight, tracking, background } = opts;
  const em = measureEm(text, tracking ?? 0.06);
  const width = Math.ceil(em * size + padding * 2);
  const height = Math.ceil(size * 1.45 + padding * 2);
  const img = new ImageClass(width, height, background ?? [0, 0, 0, 0]);
  drawText(img, text, {
    x: padding,
    y: height - padding - size * 0.25,
    size,
    color,
    weight,
    tracking,
  });
  return img;
}

