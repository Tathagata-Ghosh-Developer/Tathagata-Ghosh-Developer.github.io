# tathagata-ghosh-developer.github.io

Personal site of Tathagata Ghosh (M.Tech Computational and Data Science, IISc Bangalore): HPC, GPU computing, and the projects and numbers behind them.

Live: https://tathagata-ghosh-developer.github.io

## What it is

A single static page built with [Astro](https://astro.build). Every fact and number on the page comes from `src/data/profile.json`; the page only lays it out. No analytics, no cookies, no external fonts or scripts, no contact form.

The hero paints first as a static SVG tensor (generated at build time in `src/pages/index.astro`). One React island, `src/components/HeroScene.tsx`, then swaps in a Three.js scene: 1728 instanced cubes that split into three slabs as you scroll while 16 of them light up. Three.js, react-three-fiber and GSAP load with dynamic `import()` after the first paint. The SVG stays, and nothing 3D is downloaded, when WebGL 2 is missing, reduced motion is requested (system setting or the page's "Reduce motion" toggle), the device reports 4 CPU cores or fewer, or the WebGL context is lost. GSAP ScrollTrigger also fades sections in as they scroll into view and ticks the 0.888 counter, again only when motion is allowed.

## Build

Needs Node 20.3 or newer (developed on Node 24).

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. In the repository's Settings > Pages, set Source to "GitHub Actions". If it is left on "Deploy from a branch", GitHub also runs its own Jekyll build on every push. That build fails on the `.astro` files, so it never overwrites the site, but it marks each commit with a failed check.

## Files

- `src/data/profile.json`: the only source of facts.
- `src/layouts/Base.astro`: `<head>` tags and all CSS.
- `src/pages/index.astro`: the page, plus the scroll-reveal script.
- `src/components/HeroScene.tsx`: the 3D hero island.
- `src/pages/404.astro`: the not-found page.
- `public/og.png`: link-preview image (1200x630, rendered from HTML with headless Chrome).

## Credits

Built with Astro, `@astrojs/sitemap`, `@astrojs/react`, React, [Three.js](https://threejs.org), [react-three-fiber](https://github.com/pmndrs/react-three-fiber) and [GSAP](https://gsap.com) with ScrollTrigger.

Hero adapted from ThreeUI by Meng To, MIT: the scene structure of its "Topology Field" component (a fogged group of nodes with a slow compound idle rotation and a per-node sine pulse) from https://github.com/MengTo/threeui (`src/shaders/neuform-isolated/sources/nexus-topology.html`), rebuilt here with instanced cubes. ThreeUI is copyright (c) 2026 Meng To under the MIT licence; its npm package is not used.

## Licence

Code (everything except the content below): MIT licence, copyright (c) 2026 Tathagata Ghosh.

Content (the text and data in `src/data/profile.json`, the page copy, and `public/og.png`): copyright Tathagata Ghosh, all rights reserved.

MIT licence text:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
