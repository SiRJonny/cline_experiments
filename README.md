# BKV city bus — live viewer

This branch is the **published GitHub Pages site** for the procedural bus in
[`budapest-bus/`](https://github.com/SiRJonny/cline_experiments/tree/main/budapest-bus)
on the `main` branch. It is a copy of that folder with `index.html` at the root
so the viewer can be served directly:

* live viewer: https://sirjonny.github.io/cline_experiments/
* mesh: `assets/model/bkv_bus.obj` (+ `.mtl`, `model.json`)
* textures: `assets/textures/*.png`
* pre-rendered views: `preview/*.png`

Nothing here is hand edited — regenerate it from the `main` branch with
`node budapest-bus/tools/build-assets.mjs` and copy the folder across.
`src/`, `vendor/` and `assets/` are required at runtime; `.nojekyll` keeps
GitHub Pages from excluding `vendor/` (Jekyll excludes it by default).
