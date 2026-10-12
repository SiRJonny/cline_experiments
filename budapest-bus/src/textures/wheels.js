/**
 * Wheel textures: the tread band, the tyre sidewall (with moulded lettering)
 * and the aluminium rim.
 *
 * The tread is mapped with u around the circumference and v across the tread,
 * the sidewall with u around the circumference and v radially outwards, which
 * makes it easy to draw lettering that follows the tyre.
 */

import { Image } from '../core/image.js';
import { drawText } from '../core/font.js';
import { COLORS, satin, grainOverlay } from './palette.js';

/** Tread band: longitudinal grooves plus angled sipes. */
export function tireTread() {
  const image = new Image(512, 256, '#17181b');
  // shoulder blocks
  for (let x = 0; x < 512; x += 32) {
    image.fillRect(x, 0, 14, 256, 'rgba(0,0,0,0.35)');
    image.fillRect(x + 16, 0, 3, 256, 'rgba(255,255,255,0.05)');
  }
  // three circumferential grooves
  for (const v of [0.28, 0.5, 0.72]) {
    const y = 256 * (1 - v);
    image.fillRect(0, y - 5, 512, 10, 'rgba(0,0,0,0.55)');
    image.fillRect(0, y + 5, 512, 3, 'rgba(255,255,255,0.06)');
  }
  // angled sipes
  for (let x = 0; x < 512; x += 24) {
    image.line(x, 20, x + 18, 236, 'rgba(0,0,0,0.4)', 4);
  }
  grainOverlay(image, 0.09, 63);
  satin(image, 0.05, 19, 10);
  return image;
}

/** Tyre sidewall: rings, bead, and moulded size markings. */
export function tireSide() {
  const image = new Image(512, 512, '#1a1b1e');
  // concentric rings (v is radial: 0 = rim, 1 = tread shoulder)
  image.gradientV(
    [
      [0, 'rgba(0,0,0,0.55)'],
      [0.12, 'rgba(255,255,255,0.05)'],
      [0.3, 'rgba(0,0,0,0.25)'],
      [0.55, 'rgba(255,255,255,0.05)'],
      [0.78, 'rgba(0,0,0,0.3)'],
      [1, 'rgba(0,0,0,0.55)'],
    ],
  );
  // raised lettering, drawn along u so it wraps around the tyre
  drawText(image, 'BKV  295/80 R22.5', { x: 30, y: 200, size: 26, color: 'rgba(215,220,226,0.75)', weight: 4, tracking: 0.1 });
  drawText(image, 'BKV  295/80 R22.5', { x: 286, y: 200, size: 26, color: 'rgba(215,220,226,0.55)', weight: 4, tracking: 0.1 });
  drawText(image, 'RADIAL TUBELESS', { x: 30, y: 330, size: 16, color: 'rgba(190,196,204,0.45)', weight: 3, tracking: 0.16 });
  drawText(image, 'RADIAL TUBELESS', { x: 286, y: 330, size: 16, color: 'rgba(190,196,204,0.35)', weight: 3, tracking: 0.16 });
  grainOverlay(image, 0.1, 77);
  satin(image, 0.06, 21, 12);
  return image;
}

/** Aluminium wheel: dished rim, ventilation holes, hub and lug nuts. */
export function rimTexture() {
  const image = new Image(512, 512, '#8f959c');
  // v runs from the rim lip (0) to the hub (1)
  image.gradientV([
    [0, 'rgba(40,44,48,0.55)'],
    [0.14, 'rgba(210,216,224,0.35)'],
    [0.3, 'rgba(110,116,124,0.35)'],
    [0.52, 'rgba(190,196,204,0.3)'],
    [0.72, 'rgba(60,64,70,0.45)'],
    [1, 'rgba(30,32,36,0.6)'],
  ]);
  // spokes and ventilation holes (u is the angle around the wheel)
  const holes = 6;
  for (let k = 0; k < holes; k++) {
    const u = k / holes;
    const cx = u * 512;
    image.fillRoundRect(cx + 16, 200, 36, 112, 16, 'rgba(52,56,62,0.75)');
    image.fillRoundRect(cx + 22, 208, 24, 96, 12, 'rgba(20,22,26,0.85)');
    image.fillRoundRect(cx + 26, 214, 18, 84, 10, 'rgba(48,52,58,0.7)');
    // raised spoke between the holes
    image.fillRoundRect(cx + 62, 188, 20, 140, 8, 'rgba(226,232,240,0.22)');
  }
  // hub: a dark recess with the lug nuts and a small centre cap
  image.fillRect(0, 322, 512, 40, 'rgba(48,52,58,0.85)');
  for (let k = 0; k < holes * 2; k++) {
    image.circle((k + 0.5) * (512 / (holes * 2)), 342, 8, 'rgba(24,26,30,0.9)');
  }
  image.fillRect(0, 362, 512, 22, 'rgba(120,126,134,0.9)');
  image.fillRect(0, 384, 512, 18, 'rgba(168,174,182,0.95)');
  image.fillRect(0, 402, 512, 20, 'rgba(40,44,48,0.85)');
  // rim lip shading
  image.fillRect(0, 0, 512, 10, 'rgba(30,32,36,0.7)');
  image.fillRect(0, 500, 512, 12, 'rgba(30,32,36,0.5)');
  grainOverlay(image, 0.06, 91);
  satin(image, 0.14, 27, 26);
  return image;
}
