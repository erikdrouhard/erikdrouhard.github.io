# Erik Drouhard portfolio

The source for Erik Drouhard's personal portfolio at [erikdrouhard.github.io](https://erikdrouhard.github.io).

## Run locally

```sh
npm install
npm run dev
```

Build production output with `npm run build` and preview it with `npm run preview`.

## Routes

- `/` — portfolio homepage
- `/work/` — case studies index
- `/work/dragon-drive/` — Nuance Dragon Drive automotive HUD case study
- `/work/core-ai/` — Microsoft case study spanning Copilot Studio and Core AI
- `/work/mix-dialog/` — Nuance Mix.dialog case study

The Mix.dialog route and its optimized case-study imagery are served entirely from this repository; it does not depend on Framer at runtime.

## Deployment

Pushes to `main` are built with Vite and deployed automatically through GitHub Actions.

## Copyright

Copyright Erik Drouhard. No license is granted for the portfolio content, branding, resume, or images.
