# Typography hierarchy — 14 September 2026

Erik's latest explicit direction supersedes the earlier heading-to-role mappings. The executable specification was introduced before implementation and exposed the previous role mismatches. Erik then authorized fixing every offender. The implementation now uses the approved hierarchy below; never accept a regression by changing the expected output.

| Text purpose | Desktop / tablet, ≥810px | Mobile, <810px |
| --- | --- | --- |
| H1, exactly one rendered per content page | 36px | 20px |
| H2 | 20px | 18px |
| H3 | 16px, weight 700 | 16px, weight 700 |
| Body copy | 16px | 16px |
| Explanatory text / captions | 12px | 12px |

Only the H1 and H2/title scale steps shift. A valid token on the wrong element is still a failure. Display-sized text belongs to the H1 and its inline children, not section headings, statistics, or body copy. Hidden card templates are checked for size and weight; only the count of visible H1s excludes hidden copies. Animation clones are duplicate transient visuals, not additional semantic text.

The eight existing roles remain recognized. `type-display` follows H1, `type-section` and `type-title` follow H2, `type-support` and `type-label` are 16px/700, `type-body` stays 16px, and `type-body-small`/`type-meta` stay 12px. The two type-section aliases now select the existing display-2 and display-2-mobile steps. No primitive size was added or changed. H3 must still be 16px/700 even if it carries `type-title`.

A test cannot infer the editorial meaning of a sentence. Authors identify explanatory text with `type-body-small` or `type-meta`; `figcaption` is also explanatory. Ordinary paragraphs, list items, definition values, and blockquotes are body copy unless explicitly identified as explanatory. Changing prose into explanatory text is a content decision, not a new size. Semantic headings should use heading elements rather than enlarging a paragraph.

## Run

```sh
# Once, if the Playwright Chromium browser is not installed:
npx playwright install chromium

# Starts its own temporary local Astro server and checks the current source:
npm run check:typography

# Or explicitly target the already running local prototype:
npm run check:typography -- --url http://127.0.0.1:8796

# Full diagnostics now include the browser typography gate:
npm run check

# Fast regression tests of the validator itself:
node --test scripts/typography-contract.test.mjs
```

The browser gate reads the actual DOM and `getComputedStyle()`, after fonts load. It covers 1200, 810, 809 and 390px, in both themes. The 810/809 pair verifies both sides of the existing breakpoint. All static content routes are discovered from `src/pages`; dynamic routes must be explicitly enumerated, and an unregistered dynamic page fails the harness. The unpublished card-stack pages run in dev mode so CI cannot silently omit them.

Failures include route, viewport, theme, selector, text, expected and actual values. Complete results are saved in a new temporary directory printed by the command. Exit 1 means a contract violation; exit 2 means the harness could not run. No screenshot baseline, ignore list, or snapshot-update option exists.

`npm test` runs the validator's adversarial fixtures. `npm run check` runs the real browser gate. The branch/PR and deployment workflows install Chromium and run the gate. No GitHub settings were changed: required checks and required owner review still need repository-level protection to prevent deliberate bypasses.

## Local in-app browser adapter

`scripts/typography-browser.html` runs the same collector and validator inside actual page frames. It is a diagnostic source file, not a published route. Load it through the dev server's `/@fs/` URL using its absolute path. It covers the eight current routes and the same 64 theme/width combinations. The command-line runner's automatic route discovery remains the CI authority. The adapter restores the prior local theme preference after the run.

## Scope

The gate covers semantic HTML text, including inherited roles and nested heading text. It does not infer fonts inside raster images, PDFs, canvas pixels or external SVG documents, nor enforce the font on an empty native checkbox. Generated decorative quotation marks are outside the semantic text hierarchy. Those are separately identified in the complete font-audit HTML, which is preserved in the private parent workspace.

No new hierarchy for H4–H6 was specified in this request. They remain subject to the role and allowed-size checks; choosing their semantic mapping requires a separate explicit decision. No exceptions are granted to homepage cards' ordinary typography or per-case colors.
