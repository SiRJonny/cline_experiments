/**
 * `buildTextures()` — paints every texture of the model and returns them by
 * name.  The build tool writes them out as PNGs, the preview renderer samples
 * them straight from memory.
 *
 * @returns {Record<string, import('../core/image.js').Image>}
 */

import { bodySide, bodyFront, bodyRear, roofTexture, doorTexture } from './body.js';
import { glassTexture, bandTexture, rubberTexture, plasticTexture, metalTexture, floorTexture, seatTexture } from './surfaces.js';
import { tireTread, tireSide, rimTexture } from './wheels.js';
import {
  headlightTexture,
  taillightTexture,
  destinationFront,
  destinationSideTexture,
  destinationRearTexture,
  plateTexture,
} from './lights.js';
import { PLATES } from '../model/spec.js';

export function buildTextures() {
  const head = headlightTexture();
  const tail = taillightTexture();
  const textures = {
    // painted body panels
    bodySideR: bodySide(false),
    bodySideL: bodySide(true),
    bodyFront: bodyFront(),
    bodyRear: bodyRear(),
    roof: roofTexture(),
    doorFront: doorTexture('front'),
    doorMiddle: doorTexture('middle'),
    // glazing and trim
    glass: glassTexture(),
    band: bandTexture(),
    rubber: rubberTexture(),
    plasticDark: plasticTexture(),
    metal: metalTexture(),
    // wheels
    tireTread: tireTread(),
    tireSide: tireSide(),
    rim: rimTexture(),
    // lamps and signage
    headlight: head.map,
    headlightEmit: head.emissive,
    taillight: tail.map,
    taillightEmit: tail.emissive,
    destination: destinationFront(),
    destinationSide: destinationSideTexture(),
    destinationRear: destinationRearTexture(),
    plateFront: plateTexture(PLATES.front),
    plateRear: plateTexture(PLATES.rear),
    // interior
    floor: floorTexture(),
    seat: seatTexture(),
  };
  return textures;
}
