/**
 * Shared livery helpers: the BKV palette, a world → pixel mapper and the
 * graphics (roundel, stripes, panel seams, grime) used by several textures.
 *
 * Every texture is painted in *bus coordinates* (metres), so the artwork lines
 * up with the geometry no matter what resolution the texture is rendered at.
 * `mirror` flips the world → pixel mapping horizontally; it is used for the
 * left hand side of the bus, which is sampled with `mirrorUV` by the renderer.
 */

import { Image, makeNoise2D, fbm, makeRandom } from '../core/image.js';
import { drawText, measureEm } from '../core/font.js';

/** BKV blue livery, sampled from photos of the Budapest fleet. */
export const COLORS = {
  blue: '#123b8c',
  blueLight: '#2f63bd',
  blueDark: '#0a2560',
  blueDeep: '#071a45',
  sky: '#7fb2e5',
  white: '#eef2f5',
  offWhite: '#d8dee4',
  grey: '#b9c0c7',
  greyDark: '#5c646c',
  black: '#15171b',
  bandBlack: '#0d0f12',
  rubber: '#1c1e22',
  amber: '#ffa71f',
  red: '#d5251c',
  chrome: '#c8ced6',
};

/** World (metres) → pixel mapper for one texture. */
export function mapper(image, bounds, mirror = false) {
  const { x0 = -6, x1 = 6, y0 = 0, y1 = 1 } = bounds;
  const W = image.width;
  const H = image.height;
  const px = (x) => (mirror ? W - ((x - x0) / (x1 - x0)) * W : ((x - x0) / (x1 - x0)) * W);
  const py = (y) => H - ((y - y0) / (y1 - y0)) * H;
  const sx = (metres) => (metres / (x1 - x0)) * W;
  const sy = (metres) => (metres / (y1 - y0)) * H;
  return {
    bounds: { x0, x1, y0, y1 },
    mirror,
    W,
    H,
    px,
    py,
    sx,
    sy,
    /** Filled rectangle in world coordinates. */
    rect(target, xa, ya, xb, yb, color) {
      const left = Math.min(px(xa), px(xb));
      const width = Math.abs(px(xb) - px(xa));
      const top = Math.min(py(ya), py(yb));
      const height = Math.abs(py(yb) - py(ya));
      target.fillRect(left, top, width, height, color);
    },
    /** Vertical gradient between two world heights. */
    gradient(target, ya, yb, stops) {
      target.gradientV(stops, 0, W, py(ya), py(yb));
    },
    /** Stroke a line in world coordinates. */
    line(target, xa, ya, xb, yb, color, widthM) {
      target.line(px(xa), py(ya), px(xb), py(yb), color, Math.max(1, widthM * (sx(1) + sy(1)) * 0.5));
    },
    /** Text with the cap height given in metres. */
    text(target, str, x, y, sizeM, color, opts = {}) {
      const size = sizeM * sy(1);
      return drawText(target, str, {
        x: px(x),
        y: py(y),
        size,
        color,
        weight: opts.weight ?? size * 0.14,
        tracking: opts.tracking ?? 0.07,
        align: opts.align ?? 'left',
      });
    },
    /** Width of `str` in world metres at the given cap height. */
    textWidth(str, sizeM, tracking = 0.07) {
      return measureEm(str, tracking) * sizeM;
    },
  };
}

/** The BKV roundel: a white ring with the operator's letters inside. */
export function drawRoundel(image, m, x, y, radius, color = COLORS.white, label = 'BKV') {
  const cx = m.px(x);
  const cy = m.py(y);
  const r = m.sx(radius);
  const base = image.get(cx + r * 1.8, cy);
  image.circle(cx, cy, r, color, 0.95);
  image.circle(cx, cy, r * 0.82, base);
  drawText(image, label, {
    x: cx,
    y: cy + r * 0.22,
    size: r * 0.58,
    color,
    align: 'center',
    weight: Math.max(1, r * 0.13),
    tracking: 0.02,
  });
}

/** Vertical panel seams along the side of the bus. */
export function drawSeams(image, m, xs, color = 'rgba(0,0,0,0.25)', widthM = 0.012) {
  const { y0, y1 } = m.bounds;
  for (const x of xs) m.line(image, x, y0, x, y1, color, widthM);
}

/** Fine satin noise (brushed metal, painted plastic). */
export function satin(image, strength = 0.05, seed = 5, scale = 40) {
  const noise = makeNoise2D(seed);
  image.mapPixels((x, y, r, g, b, a) => {
    const n = (fbm(noise, x / scale, y / (scale * 4), 3) - 0.5) * 255 * strength;
    return [r + n, g + n, b + n, a];
  });
}

/** Random grain overlay (rubber, textured plastic). */
export function grainOverlay(image, amount = 0.08, seed = 9) {
  const random = makeRandom(seed);
  image.mapPixels((x, y, r, g, b, a) => {
    const n = (random() - 0.5) * 255 * amount;
    return [r + n, g + n, b + n, a];
  });
}

/** Road grime: heavier towards the bottom of the panel, with vertical streaks. */
export function roadGrime(image, m, { strength = 0.4, seed = 21, from = 0.9 } = {}) {
  const noise = makeNoise2D(seed);
  const { y0, y1 } = m.bounds;
  image.mapPixels((x, y, r, g, b, a) => {
    const worldY = y1 - (y / image.height) * (y1 - y0);
    const t = 1 - (worldY - y0) / Math.max(0.001, from - y0);
    if (t <= 0) return [r, g, b, a];
    const streak = fbm(noise, x / 6, y / 90, 4);
    const amount = Math.min(1, t) ** 1.6 * strength * (0.35 + streak);
    return [r * (1 - amount) + 30 * amount, g * (1 - amount) + 28 * amount, b * (1 - amount) + 26 * amount, a];
  });
}

/** A dark trim band drawn just above the wheel arch cut out. */
export function archTrim(image, m, archBoundary, axles, halfWidth, color = 'rgba(10,10,12,0.9)', band = 0.075) {
  const { y0, y1 } = m.bounds;
  for (const ax of axles) {
    const steps = 64;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= steps; i++) {
      const x = ax - halfWidth + (2 * halfWidth * i) / steps;
      const y = archBoundary(x);
      const yTop = Math.min(y1 - 0.001, y + band);
      outer.push([m.px(x), m.py(Math.min(y1 - 0.001, y + band * 0.2))]);
      inner.push([m.px(x), m.py(yTop)]);
    }
    image.fillPolygonAA([...inner, ...outer.reverse()], color, 0.92);
    void y0;
  }
}

