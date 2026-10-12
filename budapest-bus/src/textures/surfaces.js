/**
 * Surface textures that carry no livery: glass, the black window band, rubber,
 * dark plastic, brushed metal and the interior (floor, seat fabric).
 */

import { Image } from '../core/image.js';
import { COLORS, satin, grainOverlay } from './palette.js';

/** Tinted glazing: a cool gradient plus the black dot frit around the edges. */
export function glassTexture() {
  const image = new Image(512, 512);
  image.gradientV(
    [
      [0, '#0b1016'],
      [0.18, '#121a24'],
      [0.55, '#1d2836'],
      [0.8, '#16202c'],
      [1, '#0c1219'],
    ],
  );
  // a soft sky reflection sweeping across the pane
  image.gradientV(
    [[0, 'rgba(150,180,215,0.22)'], [0.4, 'rgba(150,180,215,0.05)'], [0.75, 'rgba(150,180,215,0.16)'], [1, 'rgba(150,180,215,0.02)']],
    40,
    470,
    0,
    512,
  );
  // frit: a dot matrix band along the bottom and top edges
  for (let y = 0; y < 512; y++) {
    const edge = Math.min(y, 511 - y);
    const rows = 26;
    if (edge > rows) continue;
    const a = (1 - edge / rows) * 0.95;
    for (let x = 0; x < 512; x += 6) {
      image.blend(x + 3, y, [6, 7, 9], a);
      image.blend(x + 3, y + 1, [6, 7, 9], a);
    }
  }
  // a black frame line just inside the edge
  image.fillRect(0, 0, 512, 3, [4, 5, 6, 255]);
  image.fillRect(0, 509, 512, 3, [4, 5, 6, 255]);
  satin(image, 0.05, 17, 60);
  return image;
}

/** The black satin band that surrounds the glazing. */
export function bandTexture() {
  const image = new Image(256, 256, COLORS.bandBlack);
  satin(image, 0.06, 23, 18);
  grainOverlay(image, 0.05, 4);
  image.gradientV([[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,0,0,0.25)']]);
  return image;
}

/** Soft black rubber (door seals, window surrounds). */
export function rubberTexture() {
  const image = new Image(256, 256, COLORS.rubber);
  grainOverlay(image, 0.12, 31);
  satin(image, 0.05, 12, 8);
  return image;
}

/** Dark plastic trim (bumpers, grille, mirror housings, roof units). */
export function plasticTexture() {
  const image = new Image(256, 256, '#23262b');
  grainOverlay(image, 0.09, 41);
  satin(image, 0.05, 29, 14);
  image.gradientV([[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.3)']]);
  return image;
}

/** Brushed / anodised metal for rails, the exhaust and small fittings. */
export function metalTexture() {
  const image = new Image(256, 256, '#aab1b8');
  image.gradientV([[0, 'rgba(255,255,255,0.25)'], [0.5, 'rgba(120,128,136,0.35)'], [1, 'rgba(255,255,255,0.2)']]);
  satin(image, 0.16, 7, 90);
  return image;
}

/** Ribbed rubber floor of a city bus. */
export function floorTexture() {
  const image = new Image(512, 512, '#3b3f45');
  for (let x = 0; x < 512; x += 16) {
    image.fillRect(x, 0, 7, 512, 'rgba(255,255,255,0.07)');
    image.fillRect(x + 8, 0, 4, 512, 'rgba(0,0,0,0.22)');
  }
  image.gradientV([[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(255,255,255,0.08)']]);
  grainOverlay(image, 0.1, 55);
  return image;
}

/** Seat fabric: dark blue moquette with a woven pattern. */
export function seatTexture() {
  const image = new Image(256, 256, '#1d2f5c');
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      const on = ((x / 8) + (y / 8)) % 2 === 0;
      image.fillRect(x, y, 8, 8, on ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)');
    }
  }
  for (let y = 0; y < 256; y += 32) image.fillRect(0, y, 256, 3, 'rgba(120,150,200,0.18)');
  grainOverlay(image, 0.12, 71);
  satin(image, 0.05, 13, 6);
  return image;
}
