/**
 * The painted body textures: both sides, front, rear, roof and the two door
 * leaves.  All of them are painted in bus coordinates through `mapper()`.
 */

import { Image } from '../core/image.js';
import { COLORS, mapper, drawRoundel, drawSeams, roadGrime, archTrim, satin } from './palette.js';
import { SPEC } from '../model/spec.js';
import { archBoundary } from '../model/panels.js';

const SKIRT_BOTTOM = SPEC.skirt;
const BELT = SPEC.belt;
const ARCH_HALF = 0.72;
const AXLES = [SPEC.axleFront, SPEC.axleRear];

const SIDE_BOUNDS = { x0: -6, x1: 6, y0: SKIRT_BOTTOM, y1: BELT };
const FACE_BOUNDS = { x0: -1.02, x1: 1.02, y0: SKIRT_BOTTOM, y1: 1.95 };

/** Blue body paint gradient, used by every painted panel. */
function paintBase(image) {
  image.gradientV(
    [
      [0, COLORS.blueDeep],
      [0.22, COLORS.blueDark],
      [0.55, COLORS.blue],
      [0.86, COLORS.blueLight],
      [1, COLORS.blue],
    ],
    0,
    image.width,
    0,
    image.height,
  );
  satin(image, 0.035, 3, 24);
}

/**
 * One side of the bus.
 * @param {boolean} mirror true for the left hand side (sampled with mirrorUV)
 */
export function bodySide(mirror = false) {
  const image = new Image(2048, 512);
  const m = mapper(image, SIDE_BOUNDS, mirror);
  paintBase(image);

  // dark skirt and the joint line above it
  m.gradient(image, SKIRT_BOTTOM, 0.62, [[0, COLORS.blueDeep], [1, 'rgba(10,37,96,0)']]);
  m.rect(image, -6, SKIRT_BOTTOM, 6, SKIRT_BOTTOM + 0.02, 'rgba(0,0,0,0.5)');
  m.line(image, -6, 0.62, 6, 0.62, 'rgba(0,0,0,0.28)', 0.012);

  // light blue "wave" stripe under the windows
  const wave = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const x = -6 + (12 * i) / steps;
    wave.push([x, 1.63 + 0.05 * Math.sin((x + 6) * 0.42) - 0.02 * (x / 6)]);
  }
  const stripe = [...wave, ...wave.slice().reverse().map(([x, y]) => [x, y - 0.1])];
  const pts = stripe.map(([x, y]) => [m.px(x), m.py(y)]);
  image.fillPolygonAA(pts, COLORS.sky, 0.95);
  const pts2 = wave.map(([x, y]) => [m.px(x), m.py(y - 0.115)]);
  image.polyline(pts2, 'rgba(238,242,245,0.55)', Math.max(1, m.sy(0.012)));

  // panel seams at the bay boundaries
  const seams = [];
  for (const bay of SPEC.bays) seams.push(bay.x0, bay.x1);
  drawSeams(image, m, seams, 'rgba(0,0,0,0.22)', 0.012);

  // operator marks: roundel behind the front door, wordmark towards the middle
  drawRoundel(image, m, 4.2, 1.36, 0.21, COLORS.white, 'BKV');
  m.text(image, 'BUDAPEST', 3.75, 1.42, 0.17, COLORS.white, { tracking: 0.12 });
  m.text(image, 'BKV Zrt.', -4.6, 1.42, 0.15, 'rgba(238,242,245,0.85)');
  m.text(image, '12 m - low floor', -4.6, 1.22, 0.09, 'rgba(238,242,245,0.5)');

  // wheel arch trims and the road dirt that collects around them
  archTrim(image, m, archBoundary, AXLES, ARCH_HALF);
  roadGrime(image, m, { strength: 0.34, from: 0.85 });
  return image;
}

/** Front face of the bus (below the windshield). */
export function bodyFront() {
  const image = new Image(1024, 1024);
  const m = mapper(image, FACE_BOUNDS, false);
  paintBase(image);
  m.gradient(image, SKIRT_BOTTOM, 0.66, [[0, COLORS.blueDeep], [1, 'rgba(10,37,96,0)']]);
  m.rect(image, -1.02, SKIRT_BOTTOM, 1.02, SKIRT_BOTTOM + 0.02, 'rgba(0,0,0,0.5)');
  // grille panel behind the slats
  m.rect(image, -0.62, 1.38, 0.62, 1.7, 'rgba(12,14,17,0.75)');
  m.rect(image, -0.62, 1.68, 0.62, 1.7, 'rgba(0,0,0,0.5)');
  drawSeams(image, m, [-0.9, -0.35, 0.35, 0.9], 'rgba(0,0,0,0.2)', 0.014);
  drawRoundel(image, m, 0, 1.28, 0.24, COLORS.white, 'BKV');
  m.text(image, 'BUDAPEST', 0.68, 0.7, 0.11, 'rgba(238,242,245,0.75)');
  roadGrime(image, m, { strength: 0.3, from: 0.8 });
  return image;
}

/** Rear face of the bus (below the rear window). */
export function bodyRear() {
  const image = new Image(1024, 1024);
  const m = mapper(image, FACE_BOUNDS, false);
  paintBase(image);
  m.gradient(image, SKIRT_BOTTOM, 0.64, [[0, COLORS.blueDeep], [1, 'rgba(10,37,96,0)']]);
  m.rect(image, -1.02, SKIRT_BOTTOM, 1.02, SKIRT_BOTTOM + 0.02, 'rgba(0,0,0,0.5)');
  drawSeams(image, m, [-0.9, -0.35, 0.35, 0.9], 'rgba(0,0,0,0.2)', 0.014);
  m.text(image, 'BKV Zrt.', -0.9, 0.72, 0.13, 'rgba(238,242,245,0.8)');
  m.text(image, 'BUDAPEST', 0.1, 0.72, 0.13, 'rgba(238,242,245,0.8)');
  roadGrime(image, m, { strength: 0.36, from: 0.82 });
  return image;
}

/** Roof: light grey, panel seams, a darker edge strip. */
export function roofTexture() {
  const image = new Image(1024, 512, COLORS.offWhite);
  const m = mapper(image, { x0: -6, x1: 6, y0: -1.2, y1: 1.2 }, false);
  m.gradient(image, 1.2, -1.2, [[0, 'rgba(150,158,166,0.55)'], [0.25, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(150,158,166,0.55)']]);
  for (let x = -5.4; x <= 5.4; x += 1.2) m.line(image, x, -1.1, x, 1.1, 'rgba(0,0,0,0.16)', 0.014);
  m.line(image, -5.9, 0, 5.9, 0, 'rgba(0,0,0,0.1)', 0.01);
  satin(image, 0.05, 11, 30);
  roadGrime(image, m, { strength: 0.18, from: 1.0 });
  return image;
}

/**
 * A door leaf.  `kind` is 'front' (single leaf) or 'middle' (double leaf).
 * The glass part of the door continues into the window band above the belt
 * line, so the top of this texture is drawn as tinted glass as well.
 */
export function doorTexture(kind = 'front') {
  const bay = SPEC.bays.find((b) => b.door === kind);
  const x0 = bay ? bay.x0 : 4.5;
  const x1 = bay ? bay.x1 : 5.5;
  const width = x1 - x0;
  const image = new Image(512, Math.round((512 * (BELT - SKIRT_BOTTOM)) / width));
  const m = mapper(image, { x0, x1, y0: SKIRT_BOTTOM, y1: BELT }, false);
  const double = kind === 'middle';
  paintBase(image);

  // rubber seal around the leaf
  const seal = 0.035;
  m.rect(image, x0, SKIRT_BOTTOM, x1, SKIRT_BOTTOM + seal, COLORS.rubber);
  m.rect(image, x0, BELT - seal, x1, BELT, COLORS.rubber);
  m.rect(image, x0, SKIRT_BOTTOM, x0 + seal, BELT, COLORS.rubber);
  m.rect(image, x1 - seal, SKIRT_BOTTOM, x1, BELT, COLORS.rubber);

  // glass: from 1.42 m up to the belt line, with a black frame
  const glassY = 1.42;
  m.rect(image, x0 + seal, glassY, x1 - seal, BELT - seal, '#0a0c10');
  m.rect(image, x0 + seal + 0.03, glassY + 0.03, x1 - seal - 0.03, BELT - seal - 0.02, '#161d26');
  // a soft reflection across the door glass
  image.gradientV(
    [[0, 'rgba(160,190,220,0.30)'], [0.45, 'rgba(160,190,220,0.06)'], [1, 'rgba(160,190,220,0.0)']],
    m.px(x0 + seal), m.px(x1 - seal), m.py(BELT - seal), m.py(glassY),
  );
  // horizontal rub rail on the leaf
  m.rect(image, x0 + seal, 1.34, x1 - seal, 1.40, 'rgba(0,0,0,0.35)');
  m.rect(image, x0 + seal, 1.30, x1 - seal, 1.34, 'rgba(238,242,245,0.12)');

  // centre joint of the double leaf
  if (double) {
    m.rect(image, (x0 + x1) / 2 - 0.015, SKIRT_BOTTOM + seal, (x0 + x1) / 2 + 0.015, BELT - seal, COLORS.rubber);
  }

  // open buttons and a small sticker
  const button = (x, y) => {
    image.circle(m.px(x), m.py(y), m.sx(0.045), 'rgba(20,22,26,0.9)');
    image.circle(m.px(x), m.py(y), m.sx(0.032), '#f4c542');
    m.text(image, 'STOP', x, y - 0.11, 0.05, 'rgba(238,242,245,0.8)', { align: 'center' });
  };
  if (double) {
    button(x0 + width * 0.28, 1.15);
    button(x0 + width * 0.72, 1.15);
  } else {
    button(x0 + width * 0.78, 1.15);
  }
  m.text(image, 'BKV', x0 + width * 0.2, 0.62, 0.12, 'rgba(238,242,245,0.55)');
  satin(image, 0.03, 6, 20);
  return image;
}
