/**
 * Sanity tests for the procedural model.
 *
 *   node budapest-bus/tests/geometry.test.mjs
 *
 * These are deliberately strict about the things a broken builder gets wrong:
 * NaN positions, non-unit normals, UVs outside 0..1, degenerate triangles,
 * materials without a texture, or geometry outside the envelope of the vehicle.
 */

import assert from 'node:assert/strict';
import { buildBus } from '../src/model/index.js';
import { buildTextures } from '../src/textures/index.js';
import { SPEC } from '../src/model/spec.js';

let checks = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};

const model = buildBus();
const textures = buildTextures();

// ---------------------------------------------------------------- structure --
ok(model.meshes.length > 15, `expected a rich model, got ${model.meshes.length} meshes`);
ok(model.materials.length > 15, `expected many materials, got ${model.materials.length}`);
ok(model.bounds.min.every(Number.isFinite) && model.bounds.max.every(Number.isFinite), 'bounds are finite');

// ------------------------------------------------------------------ meshes ---
let triangles = 0;
let vertices = 0;
const usedMaterials = new Set();
for (const mesh of model.meshes) {
  const material = model.materials[mesh.material];
  ok(Boolean(material), `${mesh.name}: material index ${mesh.material} exists`);
  usedMaterials.add(material.name);
  ok(mesh.positions instanceof Float32Array, `${mesh.name}: Float32Array positions`);
  ok(mesh.normals instanceof Float32Array, `${mesh.name}: Float32Array normals`);
  ok(mesh.uvs instanceof Float32Array, `${mesh.name}: Float32Array uvs`);
  ok(mesh.indices instanceof Uint32Array, `${mesh.name}: Uint32Array indices`);
  const n = mesh.positions.length / 3;
  ok(mesh.normals.length === n * 3, `${mesh.name}: one normal per vertex`);
  ok(mesh.uvs.length === n * 2, `${mesh.name}: one uv per vertex`);
  ok(mesh.indices.length % 3 === 0, `${mesh.name}: whole triangles`);
  ok(mesh.indices.length > 0, `${mesh.name}: has geometry`);
  triangles += mesh.indices.length / 3;
  vertices += n;

  for (let i = 0; i < mesh.positions.length; i++) ok(Number.isFinite(mesh.positions[i]), `${mesh.name}: finite position`);
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const length = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
    ok(Math.abs(length - 1) < 0.02, `${mesh.name}: unit normal (got ${length.toFixed(3)})`);
  }
  for (let i = 0; i < mesh.uvs.length; i++) {
    ok(mesh.uvs[i] >= 0 && mesh.uvs[i] <= 1, `${mesh.name}: uv in 0..1 (got ${mesh.uvs[i]})`);
  }
  for (const index of mesh.indices) ok(index < n, `${mesh.name}: index in range`);
  const same = (i, j) =>
    mesh.positions[i * 3] === mesh.positions[j * 3] &&
    mesh.positions[i * 3 + 1] === mesh.positions[j * 3 + 1] &&
    mesh.positions[i * 3 + 2] === mesh.positions[j * 3 + 2];
  let degenerate = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t];
    const b = mesh.indices[t + 1];
    const c = mesh.indices[t + 2];
    if (same(a, b) || same(b, c) || same(a, c)) degenerate++;
  }
  ok(degenerate === 0, `${mesh.name}: no degenerate triangles (found ${degenerate})`);
}
ok(model.stats.triangles === triangles, 'stats triangle count matches the meshes');
ok(triangles > 4000 && triangles < 40000, `triangle count in a sane range (${triangles})`);
ok(vertices > 2000, `vertex count sane (${vertices})`);

// ------------------------------------------------------------------ bounds ---
const [minX, minY, minZ] = model.bounds.min;
const [maxX, maxY, maxZ] = model.bounds.max;
ok(minY > -0.05 && minY < 0.05, `model sits on the road (minY = ${minY.toFixed(3)})`);
ok(maxY > 3.2 && maxY < 3.6, `roof height plausible (maxY = ${maxY.toFixed(3)})`);
ok(maxX - minX > 12 && maxX - minX < 12.4, `length is 12 m (got ${(maxX - minX).toFixed(2)})`);
ok(Math.abs(minZ) > 1.2 && Math.abs(maxZ) < 1.8, `width includes the mirrors (|z| = ${Math.abs(maxZ).toFixed(2)})`);

// ---------------------------------------------------------------- materials --
for (const material of model.materials) {
  ok(typeof material.name === 'string' && material.name.length > 0, 'material has a name');
  ok(material.roughness >= 0 && material.roughness <= 1, `${material.name}: roughness in 0..1`);
  ok(material.metalness >= 0 && material.metalness <= 1, `${material.name}: metalness in 0..1`);
  const opacity = material.opacity ?? 1;
  ok(opacity > 0 && opacity <= 1, `${material.name}: opacity in 0..1`);
  if (material.map) ok(Boolean(textures[material.map]), `${material.name}: map "${material.map}" exists`);
  if (material.emissiveMap) ok(Boolean(textures[material.emissiveMap]), `${material.name}: emissiveMap exists`);
}
ok(usedMaterials.size === model.materials.length, 'every material is used by at least one mesh');

// ---------------------------------------------------------------- textures ---
let texturePixels = 0;
for (const [name, image] of Object.entries(textures)) {
  ok(image.width > 0 && image.height > 0, `${name}: has a size`);
  ok(image.data.length === image.width * image.height * 4, `${name}: RGBA buffer matches its size`);
  const samples = [
    image.get(2, 2),
    image.get(image.width - 3, 2),
    image.get(2, image.height - 3),
    image.get(image.width - 3, image.height - 3),
    image.get(image.width >> 1, image.height >> 1),
    image.get(image.width >> 2, image.height >> 2),
  ];
  ok(samples.every((p) => Array.isArray(p) && p.length === 4), `${name}: pixels readable`);
  const distinct = new Set(samples.map((p) => p.join(',')));
  ok(distinct.size > 1, `${name}: texture is not one flat colour`);
  texturePixels += image.width * image.height;
}
ok(texturePixels > 4_000_000, `painted enough texture pixels (${texturePixels})`);

// --------------------------------------------------------------- layout ------
// doors are only fitted on the right hand side (right hand traffic)
for (const mesh of model.meshes) {
  const material = model.materials[mesh.material].name;
  if (!material.startsWith('door.')) continue;
  let minDoorZ = Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) minDoorZ = Math.min(minDoorZ, mesh.positions[i]);
  ok(minDoorZ > 0, `${mesh.name}: doors are on the right hand side (min z = ${minDoorZ.toFixed(2)})`);
}
ok(Boolean(model.meshes.find((m) => m.name === 'panel.left')), 'left hand lower panel exists');
ok(Boolean(model.meshes.find((m) => m.name === 'panel.right')), 'right hand lower panel exists');

// wheels: fitted at both axles, tyres touching the road
const tread = model.meshes.find((m) => m.name === 'wheels.tread');
ok(Boolean(tread), 'wheel tread mesh exists');
const axleHits = new Set();
let lowest = Infinity;
let highest = -Infinity;
for (let i = 0; i < tread.positions.length; i += 3) {
  lowest = Math.min(lowest, tread.positions[i + 1]);
  highest = Math.max(highest, tread.positions[i + 1]);
  for (const axle of [SPEC.axleFront, SPEC.axleRear]) {
    if (Math.abs(tread.positions[i] - axle) < 0.7) axleHits.add(axle);
  }
}
ok(axleHits.size === 2, 'wheels are fitted at both axles');
ok(Math.abs(lowest) < 0.02, `tyres touch the road (lowest = ${lowest.toFixed(3)})`);
ok(Math.abs(highest - SPEC.wheelRadius * 2) < 0.06, `tyre diameter is ${(SPEC.wheelRadius * 2).toFixed(2)} m`);

console.log(
  `geometry.test.mjs: ${checks} assertions passed ` +
  `(${triangles} triangles, ${model.meshes.length} meshes, ${Object.keys(textures).length} textures)`,
);

