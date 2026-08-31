# Erik Drouhard portfolio

The source for Erik Drouhard's personal portfolio at [erikdrouhard.github.io](https://erikdrouhard.github.io).

Built with [Astro](https://astro.build). Case studies are a content collection;
the design system lives in one stylesheet.

## Run locally

```sh
npm install
npm run dev        # 127.0.0.1:4321
```

```sh
npm run build      # static output into dist/
npm run preview    # serve dist/
npm run verify     # build, then assert dist/ is intact
```

`npm run verify` is the gate before proposing a merge. `check-dist.mjs` walks the
built output, resolves every same-origin `href`/`src`/`poster`, asserts that every
route the previous site published still exists, and fails on two same-page
keyboard shortcuts claiming one key. Check the built output, not only the dev
server — a link that resolves in dev can still 404 in `dist/`.

Check three widths when reviewing layout: **1200, 810, 390**. Regressions on this
site show up at tablet width first.

## Routes

- `/` — homepage
- `/work/` — case studies index
- `/about/` — about
- `/work/verse-design-system/` — Verse design system
- `/work/microsoft/` — Microsoft, spanning Copilot Studio and CoreAI
- `/work/mix-dialog/` — Nuance Mix.dialog
- `/work/dragon-drive/` — Nuance Dragon Drive automotive HUD
- `/work/core-ai/` — compatibility redirect to `/work/microsoft/`
- `/experiments/` and `/experiments/*` — unlisted, noindex

## Layout

```
src/styles/theme.css   the design system, and the source of truth for it
src/scripts/           field · keys · cards · theme · stagger, wired by site.js
src/layouts/           BaseLayout — canvas, shell, nav, footer, ClientRouter
src/content/work/      one MDX file per case study
src/pages/             real routes; /work/[...slug] renders the collection
public/                served verbatim: assets, experiments, case-study media
.archive/vite-mpa/     the previous Vite site, kept so the re-poured prose
                       stays checkable against the words it came from
```

### Adding or editing a case study

Edit the MDX in `src/content/work/`. The frontmatter schema is in
`src/content.config.ts`. Two rules the schema cannot enforce:

- **A metric bar renders only where `metric` supplies a real, measured number.**
  Erik's outcomes were not formally measured. No number, no bar — write
  directional impact in the prose instead.
- **`role` / `team` / `timeline` render only when present.** Leave a field out
  rather than guessing it; an absent cell is the honest result.

`draft: true` keeps an entry out of every listing and off every route. Entry
counts on the home page and work index are computed, never written by hand.

### Scripts and `<ClientRouter />`

Client navigation swaps the DOM but evaluates each module only once. So every
module initializes on `astro:page-load` rather than at import time, and the
field — which owns a `requestAnimationFrame` loop and window listeners — is
torn down when its canvas or its mode changes. Skipping that teardown leaks one
render loop per navigation until the page stutters.

## Deployment

Pushes to `main` build with Astro and deploy through GitHub Actions. Nothing else
deploys: work on a branch, open a pull request, and let Erik merge.

## Copyright

Copyright Erik Drouhard. No license is granted for the portfolio content, branding, resume, or images.
