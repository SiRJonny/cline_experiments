#!/usr/bin/env node
/**
 * Offline software renderer for the procedural BKV bus.
 *
 * Renders `buildBus()` (src/model/index.js) with the textures from
 * `buildTextures()` (src/textures/index.js) to PNG files using a dependency
 * free software rasteriser, so the model can be visually verified without a
 * GPU or a browser.
 *
 * Usage
 * -----
 *   node tools/render-preview.mjs                 # all presets @ 1600x900
 *   node tools/render-preview.mjs --only hero     # one preset
 *   node tools/render-preview.mjs --camera wheel --dist 4 --yaw 30 --pitch 12
 *   node tools/render-preview.mjs --width 1280 --height 720 --ss 2
 *   node tools/render-preview.mjs --no-ground --no-blend
 *   node tools/render-preview.mjs --selftest      # synthetic scene, asserts pixels
 *
 * See docs/INTERFACES.md for the scene / texture contract.
 */

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeImage } from '../src/core/png.js';
import { cameraFromPreset, PRESET_NAMES, CAMERA_PRESETS } from './preview/camera.js';
import { buildTextureCache } from './preview/texture.js';
import { renderScene } from './preview/raster.js';
import { runSelfTest } from './preview/selftest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..'); // budapest-bus/

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = {
    presets: null, ss: 2, width: 1600, height: 900, out: join(ROOT, 'preview'),
    blend: true, ground: true, selftest: false, quiet: false, help: false, error: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--selftest': o.selftest = true; break;
      case '--camera':
      case '--only':
        o.presets = [next()];
        break;
      case '--yaw': o.yaw = Number(next()); break;
      case '--pitch': o.pitch = Number(next()); break;
      case '--dist': o.dist = Number(next()); break;
      case '--target': o.target = next().split(',').map(Number); break;
      case '--out': o.out = resolve(process.cwd(), next()); break;
      case '--width': o.width = Number(next()); break;
      case '--height': o.height = Number(next()); break;
      case '--ss': o.ss = Number(next()); break;
      case '--fov': o.fov = Number(next()); break;
      case '--no-blend': o.blend = false; break;
      case '--no-ground': o.ground = false; break;
      case '--quiet': o.quiet = true; break;
      case '--help':
      case '-h': o.help = true; break;
      default:
        console.error(`unknown option: ${a}`);
        o.error = true;
    }
  }
  return o;
}

function printHelp() {
  console.log(`render-preview — offline software renderer for the BKV bus

  --selftest            render a synthetic scene and assert pixel colours
  --only <preset>       render a single preset (${PRESET_NAMES.join(', ')})
  --camera <preset>     alias of --only
  --yaw/--pitch <deg>   orbit overrides (azimuth / elevation)
  --dist <m>            eye distance override
  --target x,y,z        look-at override
  --width/--height <px> output size (default 1600x900)
  --ss <n>              supersample factor (default 2)
  --fov <deg>           vertical field of view override
  --out <dir>           output directory (default budapest-bus/preview)
  --no-blend            render transparent materials opaque
  --no-ground           skip the ground plane`);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Bounding box of a scene, preferring the declared `bounds`. */
function sceneBounds(scene) {
  if (scene?.bounds?.min && scene?.bounds?.max) return scene.bounds;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of scene?.meshes ?? []) {
    const p = mesh.positions;
    if (!p) continue;
    for (let i = 0; i < p.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        if (p[i + c] < min[c]) min[c] = p[i + c];
        if (p[i + c] > max[c]) max[c] = p[i + c];
      }
    }
  }
  return { min, max };
}

const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : 'n/a');
const box = (b) => `min=[${b.min.map(fmt)}] max=[${b.max.map(fmt)}] size=[${b.max.map((v, i) => fmt(v - b.min[i]))}]`;

// ---------------------------------------------------------------------------
// --selftest
// ---------------------------------------------------------------------------

function runSelftest() {
  console.log('render-preview --selftest (synthetic scene: cube + checker + glass + mirror)');
  let res;
  try {
    res = runSelfTest();
  } catch (err) {
    console.error('FAIL  selftest threw:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
    return;
  }
  for (const r of res.results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
  }
  const pass = res.pass;
  console.log(`\nselftest: ${pass ? 'PASS' : 'FAIL'} — ${res.results.filter((r) => r.ok).length}/${res.results.length} assertions`);
  if (!pass) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// main render
// ---------------------------------------------------------------------------

async function loadModules() {
  const modelPath = new URL('../src/model/index.js', import.meta.url);
  const texPath = new URL('../src/textures/index.js', import.meta.url);
  try {
    const [{ buildBus }, { buildTextures }] = await Promise.all([
      import(modelPath.href),
      import(texPath.href),
    ]);
    return { buildBus, buildTextures };
  } catch (err) {
    console.error(`cannot import the model / texture modules yet:\n  ${err.message}`);
    console.error('  (they are written by the lead agent in parallel — re-run when they land)');
    process.exitCode = 2;
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return printHelp();
  if (opts.error) {
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (opts.selftest) return runSelftest();

  const mods = await loadModules();
  if (!mods) return;

  const bus = mods.buildBus();
  const images = mods.buildTextures();
  const textures = buildTextureCache(images);
  const bounds = sceneBounds(bus);

  // Which material map names resolved to a texture?
  const mapNames = new Set();
  for (const m of bus.materials ?? []) {
    if (m.map) mapNames.add(m.map);
    if (m.emissiveMap) mapNames.add(m.emissiveMap);
  }
  const missing = [...mapNames].filter((n) => !textures.has(n));

  const presets = opts.presets ?? PRESET_NAMES;
  mkdirSync(opts.out, { recursive: true });

  console.log(`render-preview — "${bus.name ?? 'scene'}"`);
  console.log(`  model:      ${(bus.meshes ?? []).length} meshes, ${(bus.materials ?? []).length} materials`);
  console.log(`  bounds:     ${box(bounds)}`);
  console.log(`  textures:   ${textures.size} available, ${mapNames.size} referenced, ${missing.length} missing`);
  if (missing.length) console.log(`  MISSING:    ${missing.join(', ')} (falling back to baseColor)`);
  console.log(`  output:     ${opts.out} @ ${opts.width}x${opts.height}, ss=${opts.ss}, blend=${opts.blend}, ground=${opts.ground}`);

  let totalTris = 0;
  const rows = [];
  for (const name of presets) {
    if (!CAMERA_PRESETS[name]) {
      console.warn(`  ! unknown preset "${name}" — skipped`);
      continue;
    }
    const camera = cameraFromPreset(name, bounds, {
      width: opts.width, height: opts.height,
      fov: opts.fov, yaw: opts.yaw, pitch: opts.pitch, dist: opts.dist, target: opts.target,
    });
    const t0 = performance.now();
    const { image, stats } = renderScene(bus, textures, {
      camera, width: opts.width, height: opts.height,
      ss: opts.ss, ground: opts.ground, blend: opts.blend,
    });
    const bytes = encodeImage(image);
    const file = join(opts.out, `${name}.png`);
    writeFileSync(file, bytes);
    const ms = performance.now() - t0;
    totalTris += stats.triangles;
    rows.push({
      name, file, size: bytes.length, ms,
      tris: stats.triangles, drawn: stats.renderedTriangles,
      screen: stats.modelScreen, coverage: stats.modelCoverage,
    });
    const sc = stats.modelScreen;
    const bbox = sc
      ? `[${sc.minX.toFixed(0)},${sc.minY.toFixed(0)} .. ${sc.maxX.toFixed(0)},${sc.maxY.toFixed(0)}]`
      : 'none';
    console.log(
      `  ${name.padEnd(6)} ${(bytes.length / 1024).toFixed(0).padStart(4)} KiB  ` +
      `${ms.toFixed(0).padStart(4)} ms  ${stats.triangles} tris  ` +
      `coverage ${(stats.modelCoverage * 100).toFixed(1)}%  screen ${bbox}`,
    );
  }

  // ---- final summary -----------------------------------------------------
  console.log('\nsummary');
  console.log(`  meshes rendered:    ${(bus.meshes ?? []).length}`);
  console.log(`  triangles:          ${totalTris}`);
  console.log(`  all maps resolved:  ${missing.length === 0 ? 'yes' : `no (${missing.join(', ')})`}`);
  console.log(`  bounding box:       ${box(bounds)}`);
  console.log(`  files:              ${rows.map((r) => r.file).join(', ')}`);
  const ok = rows.every((r) => {
    try { return statSync(r.file).size > 1024; } catch { return false; }
  });
  console.log(`  pngs written:       ${ok ? 'yes' : 'NO — some files look empty'}`);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('render-preview failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

