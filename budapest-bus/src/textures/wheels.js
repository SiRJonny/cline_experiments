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

/** Aluminium rim: dish, lightening holes, hub and lug nuts. */
export function rimTexture() {
  const image = new Image(512, 512, '#b6bcc3');
  image.gradientV([
    [0, 'rgba(255,255,255,0.25)'],
    [0.3, 'rgba(120,126,134,0.3)'],
    [0.5, 'rgba(255,255,255,0.2)'],
    [0.7, 'rgba(120,126,134,0.3)'],
    [1, 'rgba(255,255,255,0.15)'],
  ]);
  // radial spokes and lightening holes: u is the angle, v the radius
  for (let k = 0; k < 8; k++) {
    const u = k / 8;
    const cx = u * 512;
    image.ellipse(cx, 256, 34, 62, 'rgba(24,26,30,0.85)');
    image.ellipse(cx, 256, 28, 55, 'rgba(60,64,70,0.9)');
    image.ellipse(cx, 246, 20, 40, 'rgba(120,126,134,0.35)');
  }
  // hub cap area (the middle band of the texture is the hub)
  image.fillRect(0, 236, 512, 40, 'rgba(150,156,164,0.9)');
  for (let k = 0; k < 8; k++) {
    image.circle(k * 64 + 32, 256, 9, 'rgba(70,74,80,0.9)');
  }
  // rim lip shading at the top and bottom of the texture
  image.fillRect(0, 0, 512, 12, 'rgba(40,44,48,0.6)');
  image.fillRect(0, 500, 512, 12, 'rgba(40,44,48,0.6)');
  grainOverlay(image, 0.05, 91);
  satin(image, 0.12, 27, 26);
  return image;
}
