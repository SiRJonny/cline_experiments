/**
 * Headless smoke test for the viewer's scene-graph builder.
 *
 * It imports `src/viewer/busObject.js` in plain Node (no DOM, no renderer) and
 * feeds it a *synthetic* model that follows `docs/INTERFACES.md` §2 exactly.
 * This keeps the viewer verifiable even while `src/model/**` and the PNG assets
 * are still being written by the lead.
 *
 * Run with:  node budapest-bus/tests/viewer.smoke.mjs
 */

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBusObject, disposeBusObject } from '../src/viewer/busObject.js';

// --- a very small assertion harness ----------------------------------------
let failures = 0;
let passes = 0;
/** @param {string} name @param {() => void} fn */
function test(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err?.message ?? err}`);
  }
}

// --- synthetic model --------------------------------------------------------
const TRIANGLE = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
};

const model = {
  name: 'Synthetic bus',
  bounds: { min: [-1, 0, -0.5], max: [1, 2, 0.5] },
  materials: [
    {
      name: 'body.paint',
      baseColor: [0.055, 0.17, 0.47],
      map: 'bodySideR',
      roughness: 0.35,
      metalness: 0.05,
      opacity: 1,
      transparent: false,
      emissive: [0, 0, 0],
      emissiveMap: null,
      doubleSided: false,
      mirrorUV: true,
    },
    {
      name: 'glass',
      baseColor: [0.1, 0.2, 0.25],
      map: null,
      roughness: 0.1,
      metalness: 0,
      opacity: 0.45,
      transparent: true,
      emissive: [0, 0, 0],
      emissiveMap: null,
      doubleSided: true,
      mirrorUV: false,
    },
  ],
  meshes: [
    { name: 'body.shell', material: 0, ...TRIANGLE },
    {
      name: 'glass.windows',
      material: 1,
      positions: new Float32Array([0, 0, 0, -1, 0, 0, 0, 2, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
    },
  ],
};

// A stub resolver that hands out a real (image-less) THREE.Texture for exactly
// one name, so we can assert the material wiring without touching the disk.
const requested = [];
const stubTexture = new THREE.Texture();
/** @param {string} name @returns {THREE.Texture|null} */
function resolveTexture(name) {
  requested.push(name);
  return name === 'bodySideR' ? stubTexture : null;
}

// --- the tests --------------------------------------------------------------
console.log('viewer.smoke');

let group;
test('createBusObject returns a THREE.Group', () => {
  group = createBusObject(model, { resolveTexture });
  assert.ok(group instanceof THREE.Group);
  assert.equal(group.name, 'Synthetic bus');
});

test('one mesh per model.meshes entry, in order', () => {
  assert.equal(group.children.length, model.meshes.length);
  assert.equal(group.children.length, 2);
  assert.ok(group.children.every((child) => child.isMesh));
  assert.equal(group.children[0].name, 'body.shell');
  assert.equal(group.children[1].name, 'glass.windows');
});

test('materials come from model.materials (shared instances)', () => {
  const [a, b] = group.children.map((mesh) => mesh.material);
  assert.equal(a.name, 'body.paint');
  assert.equal(b.name, 'glass');
  assert.notEqual(a, b);
  assert.equal(group.userData.materials.length, 2);
  assert.equal(group.userData.materials[0], a);
});

test('geometry has position / normal / uv attributes + Uint32 index', () => {
  for (const mesh of group.children) {
    const { geometry } = mesh;
    assert.ok(geometry.getAttribute('position'));
    assert.ok(geometry.getAttribute('normal'));
    assert.ok(geometry.getAttribute('uv'));
    assert.equal(geometry.getAttribute('position').count, 3);
    assert.equal(geometry.getAttribute('normal').count, 3);
    assert.equal(geometry.getAttribute('uv').count, 3);
    assert.equal(geometry.getAttribute('uv').itemSize, 2);
    assert.ok(geometry.index);
    assert.equal(geometry.index.count, 3);
    assert.ok(geometry.index.array instanceof Uint32Array);
  }
});

test('texture map is resolved and mirrorUV flips it (u = 1 - u)', () => {
  const paint = group.children[0].material;
  assert.ok(paint.map instanceof THREE.Texture);
  // mirrorUV: true -> a *clone* with negated repeat.x and offset 1.
  assert.notEqual(paint.map, stubTexture, 'mirrorUV should clone the texture');
  assert.equal(paint.map.repeat.x, -1);
  assert.equal(paint.map.offset.x, 1);
  // the shared source texture is left untouched
  assert.equal(stubTexture.repeat.x, 1);
  assert.deepEqual(requested, ['bodySideR']);
});

test('material flags map across (transparent / opacity / doubleSided)', () => {
  const glass = group.children[1].material;
  assert.equal(glass.map, null);
  assert.equal(glass.transparent, true);
  assert.equal(glass.opacity, 0.45);
  assert.equal(glass.side, THREE.DoubleSide);
  assert.equal(group.children[0].material.side, THREE.FrontSide);
});

test('bounding box is finite and non-empty (no NaN)', () => {
  const box = new THREE.Box3().setFromObject(group);
  assert.ok(!box.isEmpty(), 'bounding box should not be empty');
  for (const v of [...box.min.toArray(), ...box.max.toArray()]) {
    assert.ok(Number.isFinite(v), `bounding box has a non-finite value: ${v}`);
  }
});

test('disposeBusObject runs without throwing', () => {
  disposeBusObject(group);
  disposeBusObject(null);
  disposeBusObject(undefined);
  assert.ok(true);
});

test('a missing texture degrades to the base colour (no crash)', () => {
  const lonely = {
    name: 'no texture',
    materials: [{ name: 'm', baseColor: [1, 0, 0], map: 'doesNotExist' }],
    meshes: [{ name: 'm', material: 0, ...TRIANGLE }],
  };
  const g = createBusObject(lonely, { resolveTexture: () => null });
  const material = g.children[0].material;
  assert.equal(material.map, null);
  assert.ok(material.color.r > 0.9 && material.color.g < 0.1);
  disposeBusObject(g);
});

test('emissiveStrength becomes the base emissiveIntensity (default 1)', () => {
  const lit = {
    name: 'lamps',
    materials: [
      { name: 'lamp', baseColor: [1, 1, 1], emissive: [1, 0.72, 0.2], emissiveStrength: 1.6 },
      { name: 'plain', baseColor: [0.5, 0.5, 0.5] },
    ],
    meshes: [
      { name: 'lamp', material: 0, ...TRIANGLE },
      { name: 'plain', material: 1, ...TRIANGLE },
    ],
  };
  const g = createBusObject(lit);
  assert.equal(g.children[0].material.emissiveIntensity, 1.6);
  assert.equal(g.children[1].material.emissiveIntensity, 1);
  disposeBusObject(g);
});


// --- summary ----------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);

