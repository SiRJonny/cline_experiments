/**
 * Turn the plain `Scene` description returned by `buildBus()` (see
 * `docs/INTERFACES.md` §2) into a `THREE.Group` full of `THREE.Mesh` objects.
 *
 * This module is deliberately free of any DOM / renderer access: it only
 * imports three.js and copies typed arrays into buffer geometries, so it can be
 * imported and exercised in plain Node (see `tests/viewer.smoke.mjs`) as well as
 * in the browser.
 *
 * Interface assumptions (documented because the model is written in parallel):
 * - `model.meshes[i].material` is an index into `model.materials`.
 * - `positions`/`normals`/`uvs` are `Float32Array`, `indices` is `Uint32Array`.
 * - `baseColor` / `emissive` are 0..1 *display* (sRGB) components; they are
 *   converted to three's linear working space so untextured materials match the
 *   colours baked into the procedurally painted PNG textures.
 * - `mirrorUV: true` samples the map with `u = 1 - u`; this is implemented by
 *   cloning the texture and negating its `repeat.x` (the shared texture is left
 *   untouched).
 */

import * as THREE from 'three';

/** @param {ArrayLike<number>|null|undefined} a @param {number} n */
const asFloat32 = (a) => (a instanceof Float32Array ? a : new Float32Array(a ?? []));
/** @param {ArrayLike<number>|null|undefined} a */
const asUint32 = (a) => (a instanceof Uint32Array ? a : new Uint32Array(a ?? []));

/**
 * Clone `texture` and flip it horizontally so it samples with `u = 1 - u`.
 * @param {THREE.Texture} texture
 * @returns {THREE.Texture}
 */
function mirrorTexture(texture) {
  const flipped = texture.clone();
  flipped.wrapS = THREE.RepeatWrapping;
  flipped.repeat.x = -1;
  flipped.offset.x = 1;
  flipped.needsUpdate = true;
  return flipped;
}

/**
 * Build a `THREE.MeshStandardMaterial` from one entry of `model.materials`.
 * @param {object} def
 * @param {(name: string) => THREE.Texture|null} resolveTexture
 * @returns {THREE.MeshStandardMaterial}
 */
function createMaterial(def, resolveTexture) {
  const baseColor = def.baseColor ?? [1, 1, 1];
  const emissive = def.emissive ?? [0, 0, 0];

  const material = new THREE.MeshStandardMaterial({
    name: def.name ?? 'material',
    roughness: def.roughness ?? 0.5,
    metalness: def.metalness ?? 0,
    opacity: def.opacity ?? 1,
    transparent: Boolean(def.transparent),
    side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  material.color.setRGB(baseColor[0], baseColor[1], baseColor[2], THREE.SRGBColorSpace);
  material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);

  // `emissiveStrength` is an optional extension the model uses for lamps and LED
  // displays; default 1 keeps the frozen interface working unchanged. The base
  // value is remembered so main.js can brighten it at night.
  material.emissiveIntensity = def.emissiveStrength ?? 1;
  material.userData.baseEmissiveIntensity = material.emissiveIntensity;

  const map = def.map ? resolveTexture(def.map) : null;
  if (map) {
    material.map = def.mirrorUV ? mirrorTexture(map) : map;
    // The map carries the colour, so the tint stays neutral.
    material.color.setRGB(1, 1, 1, THREE.SRGBColorSpace);
  }

  const emissiveMap = def.emissiveMap ? resolveTexture(def.emissiveMap) : null;
  if (emissiveMap) {
    material.emissiveMap = def.mirrorUV ? mirrorTexture(emissiveMap) : emissiveMap;
  }

  // Keep the original description around: main.js uses it to drive the
  // wireframe / night toggles and it is handy while debugging.
  material.userData.definition = def;
  return material;
}

/**
 * Build a `THREE.BufferGeometry` from one entry of `model.meshes`.
 * @param {object} def
 * @returns {THREE.BufferGeometry}
 */
function createGeometry(def) {
  const geometry = new THREE.BufferGeometry();
  geometry.name = def.name ?? 'geometry';
  geometry.setAttribute('position', new THREE.BufferAttribute(asFloat32(def.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(asFloat32(def.normals), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(asFloat32(def.uvs), 2));
  geometry.setIndex(new THREE.BufferAttribute(asUint32(def.indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build the bus scene graph.
 *
 * @param {object} model the object returned by `buildBus()`
 * @param {object} [options]
 * @param {(name: string) => (THREE.Texture|null)} [options.resolveTexture]
 *   maps a texture name (e.g. `'bodySideR'`) to a texture, or `null` when the
 *   asset is missing.
 * @returns {THREE.Group}
 */
export function createBusObject(model, options = {}) {
  if (!model || !Array.isArray(model.meshes)) {
    throw new Error('createBusObject: expected the object returned by buildBus()');
  }
  const { resolveTexture = () => null } = options;

  const group = new THREE.Group();
  group.name = model.name ?? 'bus';
  group.userData.model = model;
  if (model.bounds) group.userData.bounds = model.bounds;

  const materials = (model.materials ?? []).map((def) => createMaterial(def, resolveTexture));
  const fallback = new THREE.MeshStandardMaterial({ name: 'fallback' });
  group.userData.materials = materials;

  model.meshes.forEach((def, index) => {
    const geometry = createGeometry(def);
    const material = materials[def.material] ?? materials[0] ?? fallback;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = def.name ?? `mesh_${index}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.meshDefinition = def;
    group.add(mesh);
  });

  return group;
}

/**
 * Release the GPU resources held by a group built with `createBusObject` (or
 * loaded through OBJLoader). Safe to call with `null`.
 * @param {THREE.Object3D|null|undefined} object
 */
export function disposeBusObject(object) {
  if (!object) return;
  object.traverse((child) => {
    if (!child.isMesh && !child.isLine && !child.isPoints) return;
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.map?.dispose?.();
      material.emissiveMap?.dispose?.();
      material.normalMap?.dispose?.();
      material.alphaMap?.dispose?.();
      material.dispose?.();
    }
  });
}
