/**
 * `--selftest`: renders a tiny synthetic scene (a textured cube, a checkerboard
 * quad, a transparent glass quad and a mirror-UV quad) and asserts concrete
 * pixel colours / depth ordering.  This proves the rasteriser, the depth
 * buffer, texture sampling, mirrorUV and alpha blending work — independently
 * of the bus model.
 *
 * The scene is built with the project's own `Part` mesh builder so it also
 * exercises the real mesh format.
 */

import { Part } from '../../src/model/builder.js';
import { Image } from '../../src/core/image.js';
import { Camera } from './camera.js';
import { buildTextureCache } from './texture.js';
import { renderScene, readPixel } from './raster.js';

const DEG = Math.PI / 180;
const RES = 256;

/** 8x8 black/white checkerboard, `size` px, top-down (like a canvas). */
function makeCheckerImage(size = 64, squares = 8) {
  const img = new Image(size, size, [0, 0, 0, 255]);
  const cell = size / squares;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const v = on ? 255 : 0;
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/** Build the synthetic test scene. */
function buildScene() {
  const cube = new Part('cube');
  cube.box([0, 0, 0], [1, 1, 1]);

  const back = new Part('back'); // big green wall behind the cube
  back.quad([-3, -3, -2], [3, -3, -2], [3, 3, -2], [-3, 3, -2], [0, 0], [1, 0], [1, 1], [0, 1]);

  const checker = new Part('checker'); // emissive checker quad, right of the cube
  checker.quad([1.0, -0.5, 2], [3.0, -0.5, 2], [3.0, 1.5, 2], [1.0, 1.5, 2], [0, 0], [1, 0], [1, 1], [0, 1]);

  const glass = new Part('glass'); // half transparent, in front of the cube
  glass.quad([0.1, -0.35, 1], [0.7, -0.35, 1], [0.7, 0.35, 1], [0.1, 0.35, 1], [0, 0], [1, 0], [1, 1], [0, 1]);

  const mirror = new Part('mirror'); // same checker, mirrored UV, left side
  mirror.quad([-2.8, -0.5, 3], [-1.2, -0.5, 3], [-1.2, 1.5, 3], [-2.8, 1.5, 3], [0, 0], [1, 0], [1, 1], [0, 1]);

  const scene = {
    name: 'preview.selftest',
    bounds: { min: [-3, -3, -2], max: [3, 3, 3] },
    materials: [
      { name: 'cube.red', baseColor: [1, 0, 0], map: null, roughness: 0.9, metalness: 0, opacity: 1, transparent: false, emissive: [0.35, 0, 0], emissiveMap: null, doubleSided: false, mirrorUV: false },
      { name: 'quad.green', baseColor: [0, 1, 0], map: null, roughness: 1, metalness: 0, opacity: 1, transparent: false, emissive: [0, 0.32, 0], emissiveMap: null, doubleSided: true, mirrorUV: false },
      { name: 'quad.checker', baseColor: [1, 1, 1], map: 'checker', roughness: 0.9, metalness: 0, opacity: 1, transparent: false, emissive: [1, 1, 1], emissiveMap: 'checker', doubleSided: true, mirrorUV: false },
      { name: 'glass', baseColor: [0.6, 0.75, 1.0], map: null, roughness: 0.15, metalness: 0, opacity: 0.5, transparent: true, emissive: [0.08, 0.12, 0.18], emissiveMap: null, doubleSided: true, mirrorUV: false },
      { name: 'quad.checkerMirror', baseColor: [1, 1, 1], map: 'checker', roughness: 0.9, metalness: 0, opacity: 1, transparent: false, emissive: [1, 1, 1], emissiveMap: 'checker', doubleSided: true, mirrorUV: true },
    ],
    meshes: [cube.toMesh(0), back.toMesh(1), checker.toMesh(2), glass.toMesh(3), mirror.toMesh(4)],
  };
  return { scene, checkerImage: makeCheckerImage() };
}


/**
 * Run the self-test.
 * @returns {{pass: boolean, results: {name:string, ok:boolean, detail:string}[], stats: object}}
 */
export function runSelfTest() {
  const { scene, checkerImage } = buildScene();
  const textures = buildTextureCache({ checker: checkerImage });
  const camera = new Camera({ width: RES, height: RES, fov: 50, near: 0.1, far: 100 });
  camera.eye = [0, 0, 8];
  camera.target = [0, 0, 0];
  camera.up = [0, 1, 0];
  camera.fovY = 50 * DEG;
  camera.aspect = 1;
  camera.update();

  const { image, stats } = renderScene(scene, textures, {
    camera, width: RES, height: RES, ss: 1, ground: false,
  });

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail });
    return ok;
  };
  const at = (wp) => {
    const p = camera.project(wp);
    return { px: readPixel(image, p.x, p.y), p };
  };

  // 1. the front face of the cube is red -----------------------------------
  const cube = at([0, 0, 0.5]);
  check('cube front face is red', cube.px[0] > 140 && cube.px[1] < 100 && cube.px[2] < 100,
    `rgb=(${cube.px.slice(0, 3)})`);

  // 2. the green wall is visible away from the cube ------------------------
  const green = at([-2.0, -1.5, -2]);
  check('green wall visible (left of cube)', green.px[1] > 110 && green.px[1] > green.px[0] && green.px[1] > green.px[2],
    `rgb=(${green.px.slice(0, 3)})`);

  // 3. depth ordering: the cube occludes the wall directly behind it -------
  const behind = at([0, 0, -2]);
  check('depth: cube occludes wall behind it', behind.px[0] > 140 && behind.px[1] < 100,
    `rgb=(${behind.px.slice(0, 3)})`);

  // 4. checkerboard texture sampling matches the reference Image.sample ----
  const uvA = [0.5625, 0.8125]; // a black square centre
  const uvB = [0.3125, 0.4375]; // a white square centre
  const refA = checkerImage.sample(uvA[0], uvA[1]);
  const refB = checkerImage.sample(uvB[0], uvB[1]);
  const ptA = at([1.0 + uvA[0] * 2, -0.5 + uvA[1] * 2, 2]);
  const ptB = at([1.0 + uvB[0] * 2, -0.5 + uvB[1] * 2, 2]);
  const close = (a, b, tol = 46) =>
    Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;
  check('checker has contrast (black vs white square)', refA[0] < 60 && refB[0] > 195,
    `refA=${refA[0]} refB=${refB[0]}`);
  check('checker dark square sampled correctly', close(ptA.px, refA),
    `render=(${ptA.px.slice(0, 3)}) ref=(${refA.slice(0, 3)})`);
  check('checker bright square sampled correctly', close(ptB.px, refB),
    `render=(${ptB.px.slice(0, 3)}) ref=(${refB.slice(0, 3)})`);

  // 5. mirrorUV samples with u = 1 - u -------------------------------------
  const mir = at([-2.8 + uvA[0] * 1.6, -0.5 + uvA[1] * 2, 3]);
  const refM = checkerImage.sample(1 - uvA[0], uvA[1]);
  check('mirrorUV flips u', close(mir.px, refM),
    `render=(${mir.px.slice(0, 3)}) ref=(${refM.slice(0, 3)})`);

  // 6. transparent glass blends over the red cube --------------------------
  const glassPx = at([0.35, 0, 1]);
  check('transparent glass blends over cube',
    glassPx.px[1] > cube.px[1] + 25 && glassPx.px[2] > cube.px[2] + 25 && glassPx.px[0] > 110,
    `cube=(${cube.px.slice(0, 3)}) glass=(${glassPx.px.slice(0, 3)})`);

  // 7. the background is sky (blue dominant) -------------------------------
  const sky = readPixel(image, 6, 6);
  check('background is sky gradient', sky[2] > sky[0] && sky[2] > 120,
    `rgb=(${sky.slice(0, 3)})`);

  const pass = results.every((r) => r.ok);
  return { pass, results, stats };
}
