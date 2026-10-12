/**
 * `buildBus()` — assembles every part of the model into the plain, dependency
 * free structure documented in `docs/INTERFACES.md` §2.
 */

import { SPEC, DESTINATION } from './spec.js';
import { Part } from './builder.js';
import { buildShell, capRing, ring, sideStations, UPPER_ROWS, LOWER_ROWS } from './body.js';
import { buildLowerPanels, buildSideGlass, buildUnderside } from './panels.js';
import { buildWheels } from './wheels.js';
import { buildFront, buildRear, buildRoof, buildMirrors, buildSideDisplays } from './details.js';
import { buildInterior } from './interior.js';

const DARK = [0.09, 0.095, 0.1];
const BLACK = [0.045, 0.045, 0.05];

/**
 * Every material of the model.  `key` is the internal name used by the geometry
 * builders, the rest is what the renderers consume.
 */
const MATERIALS = [
  { key: 'paint.sideR', name: 'paint.side.right', map: 'bodySideR', roughness: 0.34, metalness: 0.06, clearcoat: 0.6 },
  { key: 'paint.sideL', name: 'paint.side.left', map: 'bodySideL', mirrorUV: true, roughness: 0.34, metalness: 0.06, clearcoat: 0.6 },
  { key: 'paint.front', name: 'paint.front', map: 'bodyFront', roughness: 0.34, metalness: 0.06, clearcoat: 0.6 },
  { key: 'paint.rear', name: 'paint.rear', map: 'bodyRear', roughness: 0.34, metalness: 0.06, clearcoat: 0.6 },
  { key: 'paint.roof', name: 'paint.roof', map: 'roof', roughness: 0.5, metalness: 0.04 },
  { key: 'paint.plain', name: 'paint.plain', baseColor: DARK, roughness: 0.65, metalness: 0.1 },
  { key: 'band', name: 'band.black', map: 'band', baseColor: BLACK, roughness: 0.42, metalness: 0.05 },
  { key: 'glass', name: 'glass.side', map: 'glass', roughness: 0.08, metalness: 0.0, opacity: 0.82, transparent: true, doubleSided: true },
  { key: 'glass.front', name: 'glass.front', map: 'glass', roughness: 0.06, metalness: 0.0, opacity: 0.72, transparent: true, doubleSided: true },
  { key: 'door.front', name: 'door.front', map: 'doorFront', roughness: 0.4, metalness: 0.05 },
  { key: 'door.middle', name: 'door.middle', map: 'doorMiddle', roughness: 0.4, metalness: 0.05 },
  { key: 'rubber', name: 'rubber.black', map: 'rubber', baseColor: [0.035, 0.035, 0.04], roughness: 0.92, metalness: 0.0 },
  { key: 'rubber.tread', name: 'rubber.tread', map: 'tireTread', roughness: 0.9, metalness: 0.0 },
  { key: 'rubber.sidewall', name: 'rubber.sidewall', map: 'tireSide', roughness: 0.86, metalness: 0.0 },
  { key: 'metal.rim', name: 'metal.rim', map: 'rim', roughness: 0.32, metalness: 0.85 },
  { key: 'metal', name: 'metal.brushed', map: 'metal', roughness: 0.3, metalness: 0.9 },
  { key: 'plastic.dark', name: 'plastic.dark', map: 'plasticDark', roughness: 0.68, metalness: 0.08 },
  { key: 'lamp.head', name: 'lamp.head', map: 'headlight', roughness: 0.14, metalness: 0.1, emissive: [0.9, 0.9, 0.85], emissiveMap: 'headlightEmit', emissiveStrength: 0.5 },
  { key: 'lamp.tail', name: 'lamp.tail', map: 'taillight', roughness: 0.16, metalness: 0.1, emissive: [0.9, 0.15, 0.12], emissiveMap: 'taillightEmit', emissiveStrength: 0.5 },
  { key: 'led.front', name: 'led.front', map: 'destination', roughness: 0.3, metalness: 0.0, emissive: [1, 0.72, 0.2], emissiveMap: 'destination', emissiveStrength: 1.6 },
  { key: 'led.side', name: 'led.side', map: 'destinationSide', roughness: 0.3, metalness: 0.0, emissive: [1, 0.72, 0.2], emissiveMap: 'destinationSide', emissiveStrength: 1.6 },
  { key: 'led.rear', name: 'led.rear', map: 'destinationRear', roughness: 0.3, metalness: 0.0, emissive: [1, 0.72, 0.2], emissiveMap: 'destinationRear', emissiveStrength: 1.6 },
  { key: 'plate.front', name: 'plate.front', map: 'plateFront', roughness: 0.45, metalness: 0.1 },
  { key: 'plate.rear', name: 'plate.rear', map: 'plateRear', roughness: 0.45, metalness: 0.1 },
  { key: 'interior.wall', name: 'interior.wall', baseColor: [0.62, 0.63, 0.62], roughness: 0.85, metalness: 0.0, doubleSided: true },
  { key: 'interior.floor', name: 'interior.floor', map: 'floor', roughness: 0.8, metalness: 0.0 },
  { key: 'interior.seat', name: 'interior.seat', map: 'seat', roughness: 0.85, metalness: 0.0 },
];

/**
 * Build the complete bus model.
 * @returns {{name: string, bounds: object, materials: object[], meshes: object[], stats: object}}
 */
export function buildBus() {
  const parts = new Map();
  const part = (key, name) => {
    let p = parts.get(key);
    if (!p) {
      p = new Part(name ?? key);
      parts.set(key, p);
    }
    return p;
  };

  // body shell: full rings above the belt line, front/rear faces below it
  buildShell(part, { rows: UPPER_ROWS });
  buildShell(part, { rows: LOWER_ROWS, segments: ['front', 'rear'] });
  capRing(part, ring(SPEC.roofCrown, sideStations()), 'paint.roof');

  buildLowerPanels(part);
  buildSideGlass(part);
  buildUnderside(part);
  buildFront(part);
  buildRear(part);
  buildRoof(part);
  buildMirrors(part);
  buildSideDisplays(part);
  buildWheels(part);
  buildInterior(part);

  // assemble materials + meshes, dropping anything that produced no geometry
  const materials = [];
  const meshes = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  for (const [key, p] of parts) {
    if (p.triangleCount === 0) continue;
    const spec = MATERIALS.find((m) => m.key === key);
    if (!spec) throw new Error(`no material defined for part "${key}"`);
    let index = materials.findIndex((m) => m.name === spec.name);
    if (index < 0) {
      const { key: _key, ...material } = spec;
      index = materials.push(material) - 1;
    }
    const mesh = p.toMesh(index);
    meshes.push(mesh);
    triangles += p.triangleCount;
    const b = p.bounds();
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c], b.min[c]);
      max[c] = Math.max(max[c], b.max[c]);
    }
  }

  return {
    name: SPEC.name,
    bounds: { min, max },
    materials,
    meshes,
    stats: { triangles, meshes: meshes.length, materials: materials.length, textures: SPEC.textures.slice() },
    destination: DESTINATION,
  };
}

export { SPEC };
