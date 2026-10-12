/**
 * Budapest (BKV) blue city bus — browser viewer.
 *
 * Owns everything that needs a DOM: the WebGL renderer, the camera, the lights,
 * the ground, the texture loader and the HUD. The scene graph itself is built by
 * `./busObject.js` (which is headless and unit-tested) from either
 * `../model/index.js` (procedural) or the exported OBJ/MTL pair.
 *
 * The viewer degrades gracefully: if the model module or the generated assets
 * are missing it reports that in the HUD instead of throwing or showing a blank
 * page.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { createBusObject, disposeBusObject } from './busObject.js';
import { createHud } from './hud.js';

const TEXTURE_BASE = './assets/textures/';
const MODEL_BASE = './assets/model/';

/** Look of the scene for the day / night toggle. */
const THEME = {
  day: {
    sky: ['#1e4a86', '#8fb4dd', '#e6eef6'],
    fog: '#c8d8e6',
    fogNear: 45,
    fogFar: 190,
    exposure: 1.0,
    hemi: 1.15,
    key: 2.4,
    fill: 0.55,
    headlights: 0,
    emissive: 1.0,
    ground: '#6f7480',
  },
  night: {
    sky: ['#04070f', '#0b1430', '#182642'],
    fog: '#0a1222',
    fogNear: 25,
    fogFar: 120,
    exposure: 1.15,
    hemi: 0.35,
    key: 0.55,
    fill: 0.2,
    headlights: 6,
    emissive: 2.6,
    ground: '#22262e',
  },
};

/**
 * A vertical sky gradient, used as an equirectangular background.
 * @param {string[]} stops top / horizon / bottom colours
 * @returns {THREE.CanvasTexture}
 */
function makeSkyTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, stops[0]);
  gradient.addColorStop(0.55, stops[1]);
  gradient.addColorStop(1, stops[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft radial blob used as a fake contact shadow under the bus. */
function makeBlobTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Neutral checker shown when a texture PNG is missing, instead of black. */
function makeFallbackTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#8b93a1';
  const half = size / 2;
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Lazily load `assets/textures/<name>.png` and cache the textures.
 * Missing files fall back to a neutral checker and are collected in `failed`.
 * @param {(name: string) => void} [onMissing]
 */
function createTextureResolver(onMissing) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const failed = new Set();
  const fallback = makeFallbackTexture();

  /** @param {string} name @returns {THREE.Texture|null} */
  function resolve(name) {
    if (!name) return null;
    if (cache.has(name)) return cache.get(name);
    const texture = loader.load(
      `${TEXTURE_BASE}${name}.png`,
      () => {
        texture.needsUpdate = true;
      },
      undefined,
      () => {
        failed.add(name);
        texture.image = fallback.image;
        texture.needsUpdate = true;
        onMissing?.(name);
      },
    );
    texture.name = name;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    cache.set(name, texture);
    return texture;
  }

  return { resolve, failed };
}

/** Boot the viewer. Called from `index.html` (via a dynamic import). */
function main() {
  const container = document.getElementById('viewer');
  const hudRoot = document.getElementById('hud');
  const loading = document.getElementById('loading');

  // --- renderer -------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = THEME.day.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // --- scene / camera -------------------------------------------------------
  const scene = new THREE.Scene();
  const skyTextures = { day: makeSkyTexture(THEME.day.sky), night: makeSkyTexture(THEME.night.sky) };
  scene.background = skyTextures.day;
  scene.fog = new THREE.Fog(THEME.day.fog, THEME.day.fogNear, THEME.day.fogFar);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 800);
  camera.position.set(13, 8, 15);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 1.5, 0);
  controls.minDistance = 4;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.495; // never go under the road
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.update();

  // --- lights ---------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x484a44, THEME.day.hemi);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff0d8, THEME.day.key);
  key.position.set(14, 20, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9ec3ff, THEME.day.fill);
  fill.position.set(-12, 9, -8);
  scene.add(fill);

  // --- ground, grid and contact shadow --------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.day.ground), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(200, 100, 0x9fb4cc, 0x3a4658);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.position.y = 0.002;
  scene.add(grid);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 4.6),
    new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.004;
  blob.renderOrder = 1;
  scene.add(blob);

  // --- headlights (only visible at night) -----------------------------------
  const headlights = [-0.9, 0.9].map((z) => {
    const spot = new THREE.SpotLight(0xfff3d6, 0, 55, Math.PI / 8, 0.45, 1.2);
    spot.position.set(5.4, 1.0, z);
    spot.target.position.set(60, 0.15, z);
    spot.visible = false;
    scene.add(spot);
    scene.add(spot.target);
    return spot;
  });

  // --- state ----------------------------------------------------------------
  const state = { source: 'procedural', wireframe: false, night: false, framed: false };
  let currentObject = null;

  const resolver = createTextureResolver((name) => console.warn(`[viewer] missing texture: ${name}.png`));
  const hud = createHud(hudRoot, {
    onSource: (name) => setSource(name),
    onAutoRotate: (on) => {
      controls.autoRotate = on;
    },
    onWireframe: (on) => {
      state.wireframe = on;
      applyMaterialState();
    },
    onNight: (on) => {
      state.night = on;
      applyTheme(on);
    },
  });
  hud.setAutoRotate(controls.autoRotate);

  // --- theme (day / night) --------------------------------------------------
  function applyTheme(night) {
    const theme = night ? THEME.night : THEME.day;
    scene.background = night ? skyTextures.night : skyTextures.day;
    scene.fog.color.set(theme.fog);
    scene.fog.near = theme.fogNear;
    scene.fog.far = theme.fogFar;
    renderer.toneMappingExposure = theme.exposure;
    hemi.intensity = theme.hemi;
    key.intensity = theme.key;
    fill.intensity = theme.fill;
    ground.material.color.set(theme.ground);
    for (const spot of headlights) {
      spot.visible = theme.headlights > 0;
      spot.intensity = theme.headlights;
    }
    applyMaterialState();
  }

  // --- wireframe / emissive brightness --------------------------------------
  function applyMaterialState() {
    if (!currentObject) return;
    const scale = state.night ? THEME.night.emissive : THEME.day.emissive;
    currentObject.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        material.wireframe = state.wireframe;
        if ('emissiveIntensity' in material) {
          // Preserve any per-material base strength (lamps / LED displays) and
          // only scale it for the day-night toggle.
          const base = material.userData.baseEmissiveIntensity ?? 1;
          material.emissiveIntensity = base * scale;
        }
      }
    });
  }

  // --- swap the current model ------------------------------------------------
  function swapObject(object, source) {
    if (currentObject) {
      scene.remove(currentObject);
      disposeBusObject(currentObject);
    }
    currentObject = object;
    scene.add(object);
    state.source = source;
    applyMaterialState();

    // Frame the camera the first time anything appears.
    const box = new THREE.Box3().setFromObject(object);
    if (!state.framed && !box.isEmpty() && Number.isFinite(box.min.x)) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z);
      const distance = radius * 1.25;
      controls.target.copy(center);
      camera.position.set(center.x + distance * 0.7, center.y + radius * 0.5, center.z + distance * 0.95);
      camera.updateProjectionMatrix();
      controls.update();
      state.framed = true;
    }
  }

  // --- model sources ---------------------------------------------------------
  async function loadProcedural() {
    const module = await import('../model/index.js');
    const buildBus = module.buildBus ?? module.default;
    if (typeof buildBus !== 'function') throw new Error('src/model/index.js does not export buildBus()');
    const model = buildBus();
    return createBusObject(model, { resolveTexture: resolver.resolve });
  }

  async function loadExported() {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(MODEL_BASE);
    mtlLoader.setResourcePath(TEXTURE_BASE);
    const materials = await new Promise((resolve, reject) => {
      mtlLoader.load('bkv_bus.mtl', (m) => { m.preload(); resolve(m); }, undefined, reject);
    });
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.setPath(MODEL_BASE);
    const object = await new Promise((resolve, reject) => {
      objLoader.load('bkv_bus.obj', resolve, undefined, reject);
    });
    object.name = 'BKV bus (exported OBJ)';
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return object;
  }

  /** Friendly, source-aware explanation of a load failure. */
  function explain(source, err) {
    const message = err?.message ?? String(err);
    if (source === 'obj') {
      return `Could not load the exported OBJ/MTL (${message}). The assets may not be generated yet — run \`npm run build:bus\`, or switch back to the procedural source.`;
    }
    return `Could not build the procedural model (${message}). src/model/index.js may not be written yet — switch to the exported OBJ source once the assets exist.`;
  }

  async function setSource(source) {
    if (source === state.source && currentObject) return;
    hud.setBusy(true);
    hud.setSource(source);
    hud.setStatus(source === 'obj' ? 'Loading exported OBJ + MTL…' : 'Building procedural model…');
    try {
      const object = source === 'obj' ? await loadExported() : await loadProcedural();
      swapObject(object, source);
      if (resolver.failed.size > 0) {
        hud.setStatus(
          `Loaded with ${resolver.failed.size} missing texture(s): ${[...resolver.failed].join(', ')}. Run \`npm run build:bus\` to generate them.`,
          'warn',
        );
      } else {
        hud.setStatus(source === 'obj' ? 'Exported OBJ loaded.' : 'Procedural model built from code.', 'ok');
      }
    } catch (err) {
      console.error(err);
      hud.setStatus(explain(source, err), 'error');
      hud.setSource(state.source); // revert the dropdown
    } finally {
      hud.setBusy(false);
    }
  }


  // --- first load: procedural, falling back to the exported OBJ --------------
  async function boot() {
    await setSource('procedural');
    if (!currentObject) await setSource('obj');
    if (!currentObject) {
      hud.setStatus(
        'No model source is available yet. Generate the assets with `npm run build:bus` (or add src/model/index.js), then reload.',
        'warn',
      );
    }
    loading?.classList.add('hidden');
  }

  // --- render loop + resize --------------------------------------------------
  const clock = new THREE.Clock();
  let frames = 0;
  let fpsElapsed = 0;

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();
    renderer.render(scene, camera);
    frames++;
    fpsElapsed += delta;
    if (fpsElapsed >= 0.5) {
      hud.setFps(frames / fpsElapsed);
      frames = 0;
      fpsElapsed = 0;
    }
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  resize();
  animate();
  boot();
}

// Auto-start in the browser. Importing this module in plain Node is a no-op so
// the whole viewer module graph can be smoke-checked headlessly.
if (typeof document !== 'undefined') main();

