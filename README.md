# tathagata-ghosh-developer.github.io

Personal site of Tathagata Ghosh (M.Tech Computational and Data Science, IISc Bangalore): HPC, GPU computing, and the projects and numbers behind them.

Live: https://tathagata-ghosh-developer.github.io

## What it is

A static site built with [Astro](https://astro.build). Every fact and number comes from `src/data/site.json`, which holds only the public strings the site renders (it is generated outside this repository from a private master profile and checked so that every number in it appears in that master). No analytics, no cookies, no external fonts or scripts, no contact form, no email address.

The page is a terminal: a working shell you can type into (`help`, `whoami`, `top`, `ls projects/`, `open hydra`, `nvidia-smi`, `history`, `ssh iiest`, `cat thesis.md`, `cd ~/offduty`, `make chai`, `adda`, `sudo hire tathagata`, `exit`, with Tab completion and up/down history), and a recorded session that types itself as you scroll (GSAP ScrollTrigger scrubbing a tall scroll track). Typing pauses the replay; scrolling resumes it. On phones, tapping the screen opens the keyboard and a row of command chips covers the common commands. The terminal is drawn by a small renderer on a 2D `<canvas>`, so it works without WebGL. The hidden `<input>` is the real focus target, output is also announced through an `aria-live` region, and Esc leaves the shell.

When the device allows it, one React island (`src/components/Scene.tsx`, `client:idle`) puts the terminal inside a small 3D room: the canvas becomes a `CanvasTexture` on the curved screen of a CRT on a desk, next to a keyboard, a chai cup, a bicycle and a window with a moon, all built from primitives. One full-screen shader adds barrel distortion, scanlines, vignette, grain and a cheap bloom. Each command moves the camera (seat, desk, room, chai cup, bicycle). `ssh iiest` and `ssh iisc` draw a pixel map of India on the screen with the hop between Kolkata and Bengaluru, then the screen's text dissolves while a voxel campus (IIEST Shibpur's red-brick main building by the Hooghly, or IISc's sandstone Main Building with its tall tower; about 2,000 to 3,000 voxels each, one `InstancedMesh`) flies out of the screen voxel by voxel, with a pixel timeline (2020 to 2027, RMES and IBM ticks) under it. The campuses are written as layered ASCII maps in `src/lib/voxel.ts`; without WebGL the same maps are drawn as pixel art on the 2D terminal. `open hydra` lays a voxel graph on the desk whose shortest path pulses; a click picks a new route. Three.js and react-three-fiber load by dynamic `import()` only after the first paint, the load event and an idle callback, and only without reduced motion, outside plain mode, with more than 4 CPU cores and WebGL 2; otherwise (or if the WebGL context is lost) the 2D terminal stays.

The same content is always in the DOM as a compact plain-text transcript ("plain mode", the first Tab stop), which is also the whole page under reduced motion.

## Build

Needs Node 20.3 or newer (developed on Node 24).

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml` (Settings > Pages > Source must be "GitHub Actions").

## Files

- `src/data/site.json`: the only source of facts.
- `src/layouts/Base.astro`: `<head>` tags and global CSS.
- `src/pages/index.astro`: the page (terminal stage, command chips, scroll track) and the plain-mode transcript.
- `src/lib/term.ts`: the terminal: canvas renderer, shell commands, completion, history, boot and scroll replay.
- `src/lib/store.ts`: the scene store the terminal writes and the 3D room reads.
- `src/components/Scene.tsx`: the 3D room, CRT, post pass and camera rig.
- `src/lib/voxel.ts`: the voxel helper, the two campus maps, the pixel timeline and the India map hop.
- `src/pages/404.astro`: the not-found page.
- `public/og.png`: link-preview image (1200x630, rendered from HTML with headless Chrome).

## Credits

Built with Astro, `@astrojs/sitemap`, `@astrojs/react`, React, [Three.js](https://threejs.org), [react-three-fiber](https://github.com/pmndrs/react-three-fiber) and [GSAP](https://gsap.com) with ScrollTrigger.

Techniques adapted from ThreeUI by Meng To (MIT, https://github.com/MengTo/threeui; its npm package is not used): the boot progress bar follows "Uplink Loader" (a tick bar filling to 100 % with a glowing readout) and the `top` gauges follow "Diagnostics Panel" (segmented bars with value and label); the CRT shaders take the barrel curvature, sine scanlines and flicker from "Void Protocol" (the `predictive-arc` sources) and the vignette and grain from "Matrix Field". ThreeUI is copyright (c) 2026 Meng To under the MIT licence.

## Licence

Code (everything except the content below): MIT licence, copyright (c) 2026 Tathagata Ghosh.

Content (the text and data in `src/data/site.json`, the page copy, and `public/og.png`): copyright Tathagata Ghosh, all rights reserved.

MIT licence text:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
