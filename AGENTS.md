# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single static portfolio website built with Vite 7 (MPA). It has no
backend, database, or external services — everything runs client-side in the browser.
Node 22 is used (see `.github/workflows/deploy-pages.yml`).

Services and commands (see `package.json` scripts and `README.md`):

- Dev server: `npm run dev` — Vite serves at `http://127.0.0.1:5173/`. Note it binds to
  `127.0.0.1` (not `0.0.0.0`), so access it via `127.0.0.1`/`localhost` from within the VM.
- Build: `npm run build` (outputs to `dist/`). Preview the build with `npm run preview`.
- Quality checks (there is no test framework, ESLint, or Prettier): `npm run check:navigation`,
  `npm run check:experiments`, `npm run check:type`. These are custom Node validators in
  `scripts/` that enforce navigation active-state, experiment page contracts (noindex/nav/back-links),
  and the centralized type system in `styles.css`. CI (`deploy-pages.yml`) runs `check:navigation`
  before building.

Notes:

- `npm run sync:resume` depends on an external sibling `../resume/` repo and is not needed for
  local dev — committed resume PDFs in `assets/`/`public/assets/` are sufficient.
- Vite dynamically discovers `experiments/*` subdirectories as build inputs; adding a new
  experiment directory requires no config change but must satisfy `check:experiments`.
