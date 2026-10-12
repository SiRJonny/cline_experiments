# Frozen interfaces

Everything in this project talks through the two modules below. All of them are
**plain ES modules with no dependencies** (no three.js, no Node built-ins) so the
exact same code runs in the browser, in Node tooling, and in the offline
software preview renderer.

Coordinate system (right handed, metres):

* `+X` = forward, towards the front of the bus (nose points to `+X`)
* `+Y` = up
* `+Z` = right hand side of the bus (looking forward)
* `Y = 0` is the road surface, the bus is centred on `X = 0`, `Z = 0`
* `+U` of a texture runs along `+X` (front to rear mapping is chosen per face)
* `+V` of a texture runs **up** (`v = 0` is the bottom edge of the image, i.e.
  images are addressed bottom-up like OpenGL/three.js, *not* top-down like a
  canvas). The `Image` class below is top-down, the `uv()` helpers flip for you.

---

## 1. `src/textures/index.js` — `buildTextures()`

```js
import { buildTextures } from '../textures/index.js';

/** @returns {Record<string, Image>} map of texture name -> Image */
const textures = buildTextures();
// -> { bodySide: Image, bodyFront: Image, display: Image, ... }
```

`Image` comes from `src/core/image.js`:

```js
class Image {
  width;                    // px
  height;                   // px
  data;                     // Uint8ClampedArray, RGBA, 4 bytes/px, row 0 = TOP row
  get(x, y) -> [r,g,b,a]    // a in 0..255, straight (non premultiplied) alpha
  sample(u, v) -> [r,g,b,a] // bilinear, u/v in 0..1, v=0 is BOTTOM row (GL style)
}
```

## 2. `src/model/index.js` — `buildBus()`

```js
import { buildBus } from '../model/index.js';

/** @returns {Scene} */
const bus = buildBus();
// {
//   name: 'BKV Volvo 7900A (procedural)',
//   bounds: { min: [x,y,z], max: [x,y,z] },
//   materials: [
//     {
//       name: 'body.paint',          // unique
//       baseColor: [r,g,b],          // 0..1 floats, used when map === null
//       map: 'bodySide',             // texture name from buildTextures(), or null
//       roughness: 0.35,             // 0..1
//       metalness: 0.05,             // 0..1
//       opacity: 1,                  // 0..1
//       transparent: false,          // true -> alpha blended
//       emissive: [r,g,b],           // 0..1, added on top (unlit glow)
//       emissiveMap: null,           // texture name used for the emissive term
//       doubleSided: false,
//       mirrorUV: false              // true -> sample map with u = 1 - u
//     }, ...
//   ],
//   meshes: [
//     {
//       name: 'body.shell',
//       material: 0,                 // index into materials
//       positions: Float32Array,     // xyz, metres
//       normals:   Float32Array,     // xyz, unit length
//       uvs:       Float32Array,     // uv, GL convention
//       indices:   Uint32Array       // triangles, CCW front faces
//     }, ...
//   ]
// }
```

Mesh data is triangle soup only (no strips/fans), front faces are
counter-clockwise when seen from outside. Meshes may be non-manifold, that is
fine, but every mesh must have finite values, unit-length normals and UVs in
`[0, 1]`.

## 3. `src/core/png.js` — `encodePNG(width, height, rgba)`

Pure-JS PNG writer (zlib stored/deflate blocks implemented by hand, no Node
`zlib`), returns a `Uint8Array` of the `.png` file bytes. Works in the browser
too (for a future "download the model" button).

## 4. Tooling

* `tools/build-assets.mjs` — writes `assets/textures/*.png`,
  `assets/model/bkv_bus.obj`, `assets/model/bkv_bus.mtl` and
  `assets/model/model.json`.
* `tools/render-preview.mjs` — software rasteriser, renders the model (with
  textures) to `preview/*.png` using the modules above.
* `tools/serve.mjs` — zero-dependency static file server for the viewer.

The browser viewer (`index.html` + `src/viewer/main.js`) imports
`src/model/index.js` directly and loads the PNGs from `assets/textures/`.
