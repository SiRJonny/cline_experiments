/**
 * Lighting and signage textures: head and tail lamps, the amber LED
 * destination displays (drawn as a real dot matrix) and the number plates.
 */

import { Image } from '../core/image.js';
import { drawText, measureEm } from '../core/font.js';
import { COLORS, satin, grainOverlay } from './palette.js';
import { DESTINATION, PLATES } from '../model/spec.js';

/**
 * Render a dot matrix LED panel: the artwork is drawn into a scratch image and
 * then sampled on a dot grid, which gives the characteristic look of the
 * displays used on the BKV fleet.
 *
 * @param {number} width texture width in px
 * @param {number} height texture height in px
 * @param {(img: Image) => void} paint artwork, white on black
 * @param {object} o `dot` (px per dot), `colour`
 */
export function ledPanel(width, height, paint, o = {}) {
  const dot = o.dot ?? 10;
  const colour = o.colour ?? COLORS.amber;
  const artwork = new Image(width, height, '#000000');
  paint(artwork);
  const out = new Image(width, height, '#050608');
  const cols = Math.floor(width / dot);
  const rows = Math.floor(height / dot);
  const off = [70, 42, 8, 46];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < dot; y++) {
        for (let x = 0; x < dot; x++) {
          const p = artwork.get(gx * dot + x, gy * dot + y);
          sum += (p[0] + p[1] + p[2]) / 3;
          n++;
        }
      }
      const lit = sum / n / 255;
      const cx = gx * dot + dot / 2;
      const cy = gy * dot + dot / 2;
      out.circle(cx, cy, dot * 0.42, off, 0.85);
      if (lit > 0.32) {
        const strength = Math.min(1, 0.45 + lit * 1.6);
        out.circle(cx, cy, dot * 0.46, colour, strength * 0.85);
        out.circle(cx, cy, dot * 0.3, '#ffe0a0', strength);
      }
    }
  }
  satin(out, 0.03, 13, 40);
  return out;
}

/** Front destination display: route number plus the destination. */
export function destinationFront() {
  const W = 1280;
  const H = 160;
  return ledPanel(W, H, (img) => {
    drawText(img, DESTINATION.route, { x: 30, y: 134, size: 104, color: '#ffffff', weight: 21, tracking: 0.04 });
    const routeWidth = measureEm(DESTINATION.route, 0.04) * 104;
    drawText(img, DESTINATION.text, { x: 30 + routeWidth + 54, y: 130, size: 80, color: '#ffffff', weight: 17, tracking: 0.05 });
  }, { dot: 8 });
}

/** Small side display: just the route number. */
export function destinationSideTexture() {
  const W = 320;
  const H = 128;
  return ledPanel(W, H, (img) => {
    drawText(img, DESTINATION.route, { x: W / 2, y: 106, size: 86, color: '#ffffff', weight: 19, tracking: 0.04, align: 'center' });
  }, { dot: 8 });
}

/** Rear display: route number and a shortened destination. */
export function destinationRearTexture() {
  const W = 640;
  const H = 128;
  return ledPanel(W, H, (img) => {
    drawText(img, DESTINATION.route, { x: 20, y: 102, size: 80, color: '#ffffff', weight: 17, tracking: 0.04 });
    const routeWidth = measureEm(DESTINATION.route, 0.04) * 80;
    drawText(img, DESTINATION.rearText, { x: 20 + routeWidth + 34, y: 98, size: 58, color: '#ffffff', weight: 14, tracking: 0.05 });
  }, { dot: 8 });
}

/** Head lamp cluster: housing, projector lenses and the indicator. */
export function headlightTexture() {
  const image = new Image(512, 256, '#0b0d11');
  const emit = new Image(512, 256, '#000000');
  image.fillRoundRect(6, 6, 500, 244, 26, '#2b3037');
  image.fillRoundRect(12, 12, 488, 232, 22, '#15181d');
  const lens = (cx, cy, rx, ry) => {
    image.ellipse(cx, cy, rx, ry, '#2b3a4a');
    image.ellipse(cx, cy, rx * 0.86, ry * 0.86, '#48607a');
    image.ellipse(cx - rx * 0.18, cy - ry * 0.2, rx * 0.5, ry * 0.5, 'rgba(220,235,255,0.55)');
    emit.ellipse(cx, cy, rx * 0.8, ry * 0.8, 'rgba(255,252,240,0.95)');
    emit.ellipse(cx, cy, rx * 0.45, ry * 0.45, '#ffffff');
  };
  lens(150, 108, 74, 62);
  lens(300, 108, 74, 62);
  // LED daytime strip along the bottom
  for (let x = 40; x < 470; x += 26) {
    image.fillRoundRect(x, 196, 18, 16, 5, '#3c4a5c');
    image.fillRoundRect(x + 3, 199, 12, 10, 4, 'rgba(230,240,255,0.6)');
    emit.fillRoundRect(x + 2, 198, 14, 12, 4, 'rgba(255,250,235,0.85)');
  }
  // amber indicator at the outer end
  image.fillRoundRect(400, 30, 92, 60, 14, '#4a2c08');
  image.fillRoundRect(406, 36, 80, 48, 12, 'rgba(255,167,31,0.85)');
  emit.fillRoundRect(408, 38, 76, 44, 12, 'rgba(255,150,20,0.55)');
  grainOverlay(image, 0.04, 5);
  return { map: image, emissive: emit };
}

/** Tail lamp cluster: two red sections, an indicator and a reverse light. */
export function taillightTexture() {
  const image = new Image(512, 256, '#0b0d11');
  const emit = new Image(512, 256, '#000000');
  image.fillRoundRect(6, 6, 500, 244, 24, '#2b3037');
  image.fillRoundRect(12, 12, 488, 232, 20, '#14171c');
  const section = (x, y, w, h, colour, emitColour) => {
    image.fillRoundRect(x, y, w, h, 12, colour);
    image.fillRoundRect(x + 6, y + 6, w - 12, h - 12, 10, 'rgba(255,255,255,0.12)');
    emit.fillRoundRect(x + 4, y + 4, w - 8, h - 8, 10, emitColour);
  };
  section(30, 30, 130, 88, '#4a0d0a', 'rgba(255,40,30,0.85)');
  section(30, 136, 130, 88, '#4a0d0a', 'rgba(255,40,30,0.75)');
  section(180, 30, 120, 88, '#4a2c08', 'rgba(255,150,20,0.8)');
  section(180, 136, 120, 88, '#2c3238', 'rgba(240,245,255,0.7)');
  section(320, 30, 160, 194, '#4a0d0a', 'rgba(255,35,25,0.85)');
  for (let y = 46; y < 210; y += 14) {
    for (let x = 330; x < 470; x += 14) image.fillRect(x, y, 8, 8, 'rgba(255,120,110,0.18)');
  }
  grainOverlay(image, 0.04, 6);
  return { map: image, emissive: emit };
}

/** Hungarian number plate (format AB CD-123, blue EU band on the left). */
export function plateTexture(text) {
  const W = 512;
  const H = 160;
  const image = new Image(W, H, '#dfe3e7');
  image.fillRoundRect(4, 4, W - 8, H - 8, 10, '#f4f6f8');
  image.fillRect(8, 8, 66, H - 16, '#0b3a9b');
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    image.circle(41 + Math.cos(a) * 16, 52 + Math.sin(a) * 16, 3.4, '#ffd617');
  }
  drawText(image, 'H', { x: 41, y: 132, size: 34, color: '#ffffff', align: 'center', weight: 5 });
  drawText(image, text, { x: (W + 66) / 2 + 6, y: 118, size: 74, color: '#15171b', weight: 9, tracking: 0.02, align: 'center' });
  image.fillRect(0, 0, W, 4, 'rgba(0,0,0,0.35)');
  image.fillRect(0, H - 4, W, 4, 'rgba(0,0,0,0.35)');
  image.fillRect(0, 0, 4, H, 'rgba(0,0,0,0.35)');
  image.fillRect(W - 4, 0, 4, H, 'rgba(0,0,0,0.35)');
  for (const x of [120, 392]) {
    image.circle(x, 22, 6, 'rgba(90,96,104,0.8)');
    image.circle(x, H - 22, 6, 'rgba(90,96,104,0.8)');
  }
  satin(image, 0.02, 3, 30);
  return image;
}

export { PLATES };

