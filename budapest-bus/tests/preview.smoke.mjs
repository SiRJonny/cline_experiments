/**
 * Smoke test for the offline preview renderer.
 *
 * It exercises the rasteriser's own self-test (synthetic cube / checker /
 * glass / mirror scene) and then hammers the renderer with deliberately broken
 * geometry — degenerate triangles, zero-length normals, a missing texture name
 * and an out-of-range material index — to prove it degrades gracefully.
 *
 * Run with:  node budapest-bus/tests/preview.smoke.mjs
 */

import { runSelfTest } from '../tools/preview/selftest.js';
import { buildTextureCache } from '../tools/preview/texture.js';
import { renderScene } from '../tools/preview/raster.js';
import { Camera } from '../tools/preview/camera.js';
import { Image } from '../src/core/image.js';

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

// --- 1. the renderer's built-in pixel assertions ---------------------------
console.log('preview renderer: selftest scene');
const st = runSelfTest();
for (const r of st.results) {
  if (r.ok) { passes++; console.log(`  ok   ${r.name}`); }
  else { failures++; console.error(`  FAIL ${r.name} (${r.detail})`); }
}

// --- 2. robustness: broken geometry must not throw -------------------------
console.log('preview renderer: robustness');

const tinyTex = new Image(4, 4, [128, 64, 32, 255]);
const textures = buildTextureCache({ ok: tinyTex });

const brokenScene = {
  name: 'broken',
  bounds: { min: [-2, -2, -2], max: [2, 2, 2] },
  materials: [
    { name: 'a', baseColor: [0.2, 0.4, 0.8], map: 'does-not-exist', roughness: 0.4, metalness: 0.1 },
    { name: 'b', baseColor: [0.8, 0.2, 0.2], map: 'ok', transparent: true, opacity: 0.5 },
  ],
  meshes: [
    {
      name: 'degenerate',
      material: 0,
      positions: new Float32Array([0, 0, 0, 0, 0, 0, 1, 0, 0, NaN, 0, 0]),
      normals: new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      uvs: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0]),
      indices: new Uint32Array([0, 1, 2, 1, 2, 3]),
    },
    {
      name: 'missing-material',
      material: 99, // out of range -> fallback material
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1]),
      indices: new Uint32Array([0, 1, 2]),
    },
    {
      name: 'empty',
      material: 1,
      positions: new Float32Array([]),
      normals: new Float32Array([]),
      uvs: new Float32Array([]),
      indices: new Uint32Array([]),
    },
  ],
};

test('renders broken geometry without throwing', () => {
  const camera = new Camera({ width: 128, height: 96, fov: 40 });
  camera.eye = [0, 0, 6];
  camera.target = [0, 0, 0];
  camera.update();
  const { image, stats } = renderScene(brokenScene, textures, {
    camera, width: 128, height: 96, ss: 2, ground: true,
  });
  if (image.width !== 128 || image.height !== 96) throw new Error('bad output size');
  if (!stats.unresolved.includes('does-not-exist')) throw new Error('missing map not reported');
  if (stats.meshes !== 3) throw new Error(`expected 3 meshes, got ${stats.meshes}`);
});

test('reports unresolved texture names', () => {
  const camera = new Camera({ width: 64, height: 64, fov: 40 });
  camera.eye = [0, 0, 6];
  camera.target = [0, 0, 0];
  camera.update();
  const { stats } = renderScene(brokenScene, textures, { camera, width: 64, height: 64, ss: 1 });
  if (stats.unresolved.length === 0) throw new Error('expected at least one unresolved map');
});

// --- summary ---------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
