# Concrete design-system contract

Erik authorized this consolidation on 2026-09-14. `src/styles/tokens.css` owns the approved values; `scripts/token-contract.json` freezes their names, selector/media scopes and values. `AGENTS.md` is the governing instruction. Older design-system notes are historical context, not authority to change this contract.

## Routine edits

Select an existing spacing token or semantic role. Use exactly one `type-*` role on text owners; inline emphasis may inherit. All eight roles load globally. Ordinary inset surfaces share `--case-inset`; feature cards share `--feature-card-padding`; page edges share the responsive gutter contract. These are different roles within one scale, not page-specific copies.

No raw visual values, unknown variables, literal fallbacks, local primitive overrides, or arithmetic to synthesize intermediate spacing. Do not create a new token merely to pass validation. Do not alter an existing scale step to satisfy one page.

Chromatic families use the same numbered lightness/chroma steps and differ only in hue. Larger numbers are darker and more chromatic. Neutrals remain achromatic. Both themes select from the same fixed ramps. Common line, surface, muted-text and accent-surface recipes are defined only in tokens.css and re-evaluate within themed subtrees. They cannot be re-mixed in page CSS. The dark end of the chromatic ramp stops before near-black, where increasing chroma would leave the shared sRGB gamut; neutral tokens provide black and near-black grounds.

## Approved boundaries

- Homepage card interaction: named motion poses, magnetic response, drag/release physics and depth. Shared timing and easing are read from CSS. Ordinary card type, padding, buttons and selector spacing stay on the core scale.
- Homepage particles: measured canvas dimensions and effect-specific simulation parameters. Color comes from the resolved primary role, not a duplicated RGB palette. Inner pages receive static texture with no pointer listener or animation loop.
- Case identity: hue changes through approved aliases. No independent per-case size, typography or tonal ramp.
- Geometry is not a new scale: intrinsic media ratios, fractional grid tracks, viewport fitting, full-bleed centering, safe-area additions, switch travel derived from its track/knob, and signed existing-step displacement are explicitly checked relationships. New relationships require review; a `calc()` wrapper is not a blanket exemption.

## Approval and enforcement

`npm run check:tokens` checks parsed CSS, markup and script style writes against the contract. `npm test` includes deliberate bypass attempts. `npm run check` also runs Astro diagnostics. The token snapshot has no automatic update command. Legacy violation baselines cannot grow; `--write` is disabled.

Changing scales, aliases, recipes, approved exceptions or checker policy requires an exact proposal to Erik: purpose, proposed change, existing alternatives considered, and affected UI. After explicit approval, update the implementation and reviewed contract together, then run the tests and responsive verification. A hash is an integrity check, not proof that Erik approved a change.

Dormant CaseMeta, CaseNav, Figure and Metric files remain untouched under AGENTS.md. Literal checks still inspect them. Their legacy missing-role markup is not an active UI exemption: importing one into use activates the role checks and requires a reviewed promotion.

`npm run check:token-review -- --base <trusted-revision>` fails when the token contract or its enforcement files differ from the trusted base, even if a matching snapshot and hash were also edited. CI reports these changes for review. CODEOWNERS assigns token, policy, package and workflow changes to Erik. There is no automatic approval or baseline refresh.

Local validation cannot stop an author who also rewrites the validator and its contract. The GitHub approval gate and ownership policy must be protected by required owner review and required CI checks in repository settings to enforce that trust boundary remotely. This local cleanup does not change GitHub settings or publish the branch.

## Verification

Check at 1200, 810 and 390 pixels, both themes, and reduced motion. Verify computed text edges and insets as well as source tokens: a valid spacing token can still be applied by the wrong selector. Retain the original CSS audit at `.scratch/css-system-audit-2026-09-14/report.md` in the private parent workspace; remediation evidence is recorded alongside it without rewriting the audit.

## Reduced-motion ownership

Tokens zero shared durations; theme.css disables element and pseudo-element animation/transition. View-transition pseudo-elements have their own stop rule. Entering/leaving content resets transform and opacity so it remains visible. The About discovery control has a static placement. JavaScript owns cancellation and static rendering for the particle field, card stack and game/sheet lifecycle. Feature CSS does not repeat the global transition stop.

## Approved typography correction, 2026-09-14

Erik clarified the hierarchy after reviewing the font audit: H1 36→20, H2 20→18, H3 16/700 unchanged, body 16 unchanged, explanatory text 12 unchanged. `docs/typography-contract.md` is the new test-first specification. After the failing test was established, Erik authorized fixing all offenders. The two type-section aliases now select display-2 and display-2-mobile. All primitive scales remain unchanged. Markup uses H1/display, H2/section, H3/support, body/body, and captions/body-small. The gate must never be made green by changing the expected hierarchy or adding a baseline.
