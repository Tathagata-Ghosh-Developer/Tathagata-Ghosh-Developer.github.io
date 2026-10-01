# tathagata-ghosh-developer.github.io

Personal site of Tathagata Ghosh (M.Tech Computational and Data Science, IISc Bangalore): HPC, GPU computing, and the projects and numbers behind them.

Live: https://tathagata-ghosh-developer.github.io

## What it is

A static site built with [Astro](https://astro.build). Every fact and number comes from `src/data/site.json`, which holds only the public strings the site renders (it is generated outside this repository from a private master profile and checked so that every number in it appears in that master). No analytics, no cookies, no external fonts or scripts, no contact form, no email address.

The page is a terminal (v3, in progress): a working shell you can type into, and a recorded session that replays as you scroll. The same content is always in the DOM as a compact plain-text transcript ("plain mode"), which is also the whole page under reduced motion.

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
- `src/pages/index.astro`: the page and the plain-mode transcript.
- `src/pages/404.astro`: the not-found page.
- `public/og.png`: link-preview image (1200x630, rendered from HTML with headless Chrome).

## Credits

Built with Astro and `@astrojs/sitemap`.

## Licence

Code (everything except the content below): MIT licence, copyright (c) 2026 Tathagata Ghosh.

Content (the text and data in `src/data/site.json`, the page copy, and `public/og.png`): copyright Tathagata Ghosh, all rights reserved.

MIT licence text:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
