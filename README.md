# Erik Drouhard portfolio

The source for Erik Drouhard's personal portfolio at [erikdrouhard.github.io](https://erikdrouhard.github.io).

Built with [Astro](https://astro.build). Each case study is a hand-written page;
a small content collection supplies the home-page cards, and the design system
lives in one stylesheet.

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

**One guard did not come across in the port.** The old site ran
`check-type-system.mjs`, which enforced that only the stylesheet owning the type
roles may declare `font-family`, `font-size`, `font-weight` or `line-height` —
everything else consumes a `type-*` class or a `--type-*` token. The ported case
studies depend on that rule and nothing enforces it here. The script is in
`.archive/vite-mpa/scripts/`; restoring it needs its `OWNERS` set repointed at
`styles/theme.css` and `styles/case.css`. As of this writing the rule still
holds across `src/` with zero violations — so restoring it would lock in a
property the port has, not ask anyone to go fix one.

## Routes

- `/` — homepage, and the only listing of the work
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
src/styles/work/       one stylesheet per case study, ported from the old site
src/scripts/           field · keys · cards · theme · stagger, wired by site.js
src/layouts/           BaseLayout — canvas, shell, nav, footer, ClientRouter
src/content/work/      card metadata only — one frontmatter-only file per study
src/pages/             real routes, including one .astro file per case study
public/                served verbatim: assets, experiments, case-study media
.archive/vite-mpa/     the previous Vite site, the source the case-study pages
                       and stylesheets were ported from
.archive/src/          the retired MDX pipeline: /work/ index, [...slug], and
                       the case-study bodies as they were before the port
```

### There is no `/work/` index

It was retired: with four studies and nothing else to show, an index page listed
exactly what the home page already lists. The home-page grid is now the only
listing, so **every published entry appears there** — there is no featured cap
to hide a fifth study. `/work/` deliberately 404s, and `check-acceptance.mjs`
asserts that it does. `/work/core-ai/` still redirects to `/work/microsoft/`,
because that URL shipped on the old site.

### Adding or editing a case study

A case study is two hand-written files plus one card:

1. `src/pages/work/<slug>.astro` — the page. It renders `BaseLayout` with
   `shell="case"`, `field="off"`, and a `bodyClass` its stylesheet is scoped to
   (`drive-page`, `mix-page`, `core-ai-page`). Its `title` and `description` are
   its own; nothing else supplies them.
2. `src/styles/work/<slug>.css` — the page's styles, imported by that page.
3. `src/content/work/<slug>.mdx` — **frontmatter only**. It exists so the home
   page can render a card, and carries nothing else: `title`, `org`, `summary`,
   `featured`, `order`, `key`, `draft`. Adding a body does nothing; nothing
   renders it. The schema is in `src/content.config.ts`.

The prose lives in the page, not the collection. This is the reverse of the
earlier design, where an MDX body was poured into a shared template — that
template flattened the published layouts and is now in `.archive/src/`.

The `.mdx` filename **is** the entry id, and the card links to `/work/<id>/`.
So the filename must match the page filename exactly — promote a draft without
writing its page and the card becomes a 404. `check-dist.mjs` catches that: it
resolves every built link, so a card pointing at a route that was never
generated fails the build gate rather than shipping.

`draft: true` keeps an entry off the home grid and out of the entry count. The
count is computed from the same list that renders the cards, never by hand.

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
