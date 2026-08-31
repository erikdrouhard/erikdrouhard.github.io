# GAPS

What this is: every place the four re-poured case studies are missing something, or where the old page held content the new template has no home for.

Nothing here was filled with invented content. No metric was manufactured, no role or date was guessed, no missing caption was written. Where a source page said something and the new page does not, it is listed below as a loss, not smoothed over. Every item needs your own answer — an agent cannot supply any of them.

Four studies shipped non-draft: `verse-design-system`, `microsoft`, `mix-dialog`, `dragon-drive`.

---

## Verse design system

### case-meta fields with no source

`CaseMeta.astro` renders only the cells that have a value, so all three cells currently render — but one of them is a relabel, not a sourced fact.

- **`team`** — filled with `"UX · UX engineering · Product engineering · Design leadership"`, taken verbatim from the source `<dl>` cell labeled **Partners**. The source states no team size or composition. The template's label is "Team". If "Team: UX · UX engineering · Product engineering · Design leadership" misreads, delete the `team` line; nothing else depends on it.
- **`role`** and **`timeline`** are sourced verbatim ("Senior UX Engineer · Verse design-system DRI", "2021–2023").
- **Dropped `<dl>` cell:** the source had a third cell, **Focus** — "Strategy · Architecture · Figma adoption · Accessibility". The meta grid is role/team/timeline only, so this string is nowhere in the MDX.

### Figures without captions

16 of 34 figures render with no caption, because the source gave them none — only `alt` text and an "open full size" aria-label.

- Mix.tokens teaching deck: `mix-tokens-1` … `mix-tokens-4` (4 figures)
- Nuance i3 story slides: slides 4, 16-B, 19, 27, 29, 42, 48, 60, 71, 76, 77, 80 (12 figures)

Both groups were horizontal scrollers in the source, where the slide image carried the meaning on its own.

Also: **"Open full size to zoom." / "Open for an expanded view." was trimmed from 15 captions.** Every source figcaption ended with one of those two sentences. Each figure still carries `href` to the full-size asset, so the behavior survives; the sentence does not.

### Candidate metric numbers

No metric bar was rendered for this study, and `metric` is omitted from frontmatter. These are numbers that already exist in the prose — they are not measurements of the work, and whether any becomes a metric is your call.

- "Turn 2–3 years of design-engineering groundwork into a platform strategy"
- "I worked directly with Finance to bring Figma to Nuance CoreAI and Healthcare, then trained three design teams to use it effectively."
- "…to show how much Verse contained: dozens of shared and Mix-specific components, plus foundations, accessibility patterns, variants, structural guidance, and full-page UI parts."
- "I presented the strategy at Nuance i3 in 2022 under the earlier Bolt name."
- Gallery label: "Mix.tokens teaching deck · 4 slides"
- Filename only, never in prose: `Verse Timelines with the teams of 5.png`

None is a measured outcome. "dozens" is the only one gesturing at scale, and it is not a number.

### Content that did not fit the template

1. **Two media scrollers became vertical figure runs.** The 4-slide token deck and the 12-slide i3 deck were scroll-to-compare regions. There is no scroller component, so they are 16 stacked figures. Section 07 is now a 12-figure wall. Lost: the side-by-side comparison the scroller made possible.
2. **Scroll-affordance text dropped.** Both gallery labels ended "Scroll to compare · Select to expand →". The affordance no longer exists; the descriptive half survives as an `###` subheading.
3. **Two paragraph-length figcaptions moved into body prose.** `verse-components-list` (~340 chars) and `verse-accessibility-spec` (~230 chars) would be unreadable in mono uppercase. The figure keeps a short label as its caption and the full text follows as a normal paragraph. No words lost; they are body copy now, not caption.
4. **Item labels folded into captions.** The source rendered a separate eyebrow above many figures ("BEFORE · MIX.DIALOG", "TOKEN DECISIONS", "TEAM MODEL"). Figure has one caption slot, so each is now a prefix: `LABEL — CAPTION TEXT`.
5. **Numbered section eyebrows dropped** (01 · SITUATION … 08 · RESULT, plus PROVENANCE and CREDIT). They paired with the sticky chapter nav, which is also gone.
6. **The four action cards** (01 · MAKE THE CASE … 04 · PLAN THE PROGRAM) became `###` + paragraph, the numbered label kept as a bold lead-in. Every word kept; the card grid is gone.
7. **Three-column definition list** (Adopt / Extend / Compose) became a bullet list. **Three-column results grid** ("A public component library", "One language across tools", "A foundation for product expression") became three `###` + paragraph pairs, which reads more heavily than the source's compact grid.
8. **Testimonials** became blockquotes with an em-dash attribution. The component styling and the role-only `<figcaption>` are gone; quotes and role labels survive verbatim.
9. **The Storybook callout lost its weight.** It was a full-bleed link card — eyebrow, title, blurb, pill button. It is now `### Explore the live Verse UI Storybook` plus a paragraph ending in an inline link. The URL survives (`https://verse-ui.azurewebsites.net/?path=/story/intro-welcome--welcome`). This is the study's only outbound link.
10. **The closing footer's CTAs dropped.** "Design systems are organizational systems." and its closing line survive as a final `##` + paragraph; the "Read Mix.dialog" and "Get in touch" pills were nav chrome.
11. **The hero image appears twice.** `Verse Team breakdown.png` is the hero figure and appears again in section 05 as "TEAM MODEL" with different alt and caption — as the source had it. If a hero image ever comes from frontmatter, the first occurrence is the one to drop.
12. **The deck paragraph and the `summary` say nearly the same thing.** The body's first paragraph is the source deck verbatim; the approved `summary` is a reworded version of it. They now sit close together.

### Missing or excluded assets

- All 32 referenced paths verified present under `public/`. Zero missing.
- **Two filenames contain literal spaces:** `Verse Team breakdown.png` and `Verse Timelines with the teams of 5.png`. Written with raw spaces, matching the source HTML, which shipped this way. If `Figure.astro` ever does URL construction or a glob lookup on `src`, these break first.
- Source `href` values were inconsistent (some absolute, some relative) but resolved to the same files; all were normalized to the absolute form.

---

## Microsoft

### case-meta fields with no source

`timeline` is the only cell with a value, so the meta grid currently renders **one cell**.

- **`role` — omitted.** The source states three distinct titles across the span and no single one is honest for a study covering both the Copilot Studio and CoreAI chapters. Verbatim candidates from the timeline headings:
  - "Product Designer I · Copilot Studio"
  - "Promoted to Product Designer II"
  - "UX Engineer II · Microsoft CoreAI"

  Any joined form would be invented connective text, so none was written.
- **`team` — omitted.** No team size is stated. The nearest numbers describe the organization supported, not a team belonged to: "help a 30+ person design organization explore, critique, and build AI products faster"; "30+ designers — Internal tools and AI-native workflow enablement"; "A prototyping layer for a 30+ person design team." Using "30+ designers" as `team` would misread the sentence.
- **`timeline` — filled** as `"March 2022–present"`, verbatim from the hero eyebrow. The frontmatter `org` reads "Mar 2022–Present" — same fact, different casing and abbreviation.

### Figures without captions

None. Both shipped figures carry captions.

**Caption truncation, though:** both source figcaptions were 3–4 sentence paragraphs carrying load-bearing disclaimers ("Shown as design exploration, not as a shipped Copilot Studio interface"; "is not presented as an official Microsoft implementation"). A mono uppercase caption cannot hold that, so each figure got a short uppercase caption and the **full** figcaption text was re-poured as a plain paragraph immediately below. No disclaimer was lost; it reads as a duplicated caption.

### Candidate metric numbers

No metric bar was rendered, and `metric` is omitted. Every outcome in the "Leadership as infrastructure" section is directional by construction ("Helped designers…", "Made interactions executable earlier…", "Improved the context agents received…"). The numbers that exist in the prose, verbatim:

- "help a 30+ person design organization explore, critique, and build AI products faster"
- "30+ designers"
- "A prototyping layer for a 30+ person design team."
- "including a three-day stakeholder design sprint on the largest Mix-to-Copilot Studio parity opportunities"
- "I planned and ran a three-day workshop to convert a broad parity goal into a shared view of the highest-value problems to pursue."

These are headcounts and durations found in existing prose, not measurements. None is a measured result.

### Content that did not fit the template

1. **A figure was dropped as an image.** The Microsoft Learn condition-node screenshot's `src` is a remote hotlink (`https://learn.microsoft.com/en-us/microsoft-copilot-studio/media/authoring-condition-node/authoring-condition-node-new-condition.png`), not a file under `public/`. It was re-poured as a prose paragraph keeping the alt text, the "this is not a private project artifact" disclaimer, and the live link to the documentation. Words intact; the image is gone. If `Figure.astro` passes `src` through to a plain `<img>`, this can be restored as a figure.
2. **Section eyebrows kept as italic kicker lines**, deviating from the contract. Only two are numbered ("Chapter 01 · Copilot Studio", "Chapter 02 · Microsoft CoreAI"); the other seven carry meaning not repeated by their `<h2>`: "Role progression", "Three-day design sprint", "The prototype portfolio", "Azure portals", "Leadership as infrastructure", "Evidence model", "Colleague recommendation" (×2). They sit under each `##` as italics. If the template grows a kicker slot, these are its content.
3. **Hero "AI PRODUCT DESIGN LOOP" graphic** (three steps plus an OUTPUT cell) became `### AI product design loop` and a bullet list. Its `aria-label` ("Abstract prototyping loop moving from explore, to make it real, to evaluate, and back to iteration.") is not in the output.
4. **Timeline `<ol>`** became one `###` per entry with the `<time>` label folded into the heading. The `datetime` attributes (2022-03, 2023-08, 2025-03) are gone; one entry never had one ("During Copilot Studio tenure").
5. **Sprint grid / prototype grid / outcome grid / link grid** flattened to `###` + paragraph. The card label spans — "Official work · private", "Official work · unfinished", "Representative reconstruction" — became italic lines under each heading. These labels are the evidence-classification system and are now the thing most likely to be read as decoration.
6. **Evidence key** (four label chips) became one inline bolded run. Reads worse than the source chips.
7. **`system-arrow`** "Idea → behavior → feedback → iteration" is now a bare paragraph with no visual treatment.
8. **`applied-work-link` aside** (Azure SRE Agent public context) became a bold-lead paragraph with the link inline.
9. **Colleague recommendations** (Alex Britez, Xiaowei Jiang) became `##` on the name, attribution as plain paragraphs, quote body as a blockquote. Both source dates read 2026 (July 20, 2026 / July 11, 2026) and were left exactly as written rather than "corrected" — worth a look.
10. **Old nav anchors are gone.** Section `id`s `#progression`, `#parity`, `#core-ai`, `#evidence` no longer exist; any external deep link to them will break.
11. **Hero CTA buttons dropped:** "Read the story" (in-page anchor) and "Visit Microsoft Foundry". The Foundry link survives in the Evidence section, so no URL was lost.

### Missing or excluded assets

- No missing local assets. `public/work/microsoft/` does not exist; both images live under `public/assets/case-studies/` and were verified present: `condition-table-wire.png` (63KB) and `agent-canvas-architecture.svg` (23KB).
- The only unresolvable reference is the learn.microsoft.com hotlink above.
- Source `width`/`height` on the condition-table image (1407×788) had nowhere to go in the Figure API.

---

## Mix.dialog

### case-meta fields with no source

`role` and `team` render; **`timeline` is empty, so the meta grid shows two cells.**

- **`timeline` — omitted, needs your decision.** The source eyebrow says `Mix.dialog · Nuance · 2019–2022`, the approved `org` value is `Nuance · 2019–2023`, and the epilogue eyebrow says `06 · EPILOGUE · 2021–2023`. Filling the cell from the eyebrow would have put "2019–2022" on the same page as an org line reading "2019–2023".
- **`role` — filled** verbatim: "Senior UX Designer and interaction design lead".
- **`team` — filled** verbatim from the source `<dl>` **Partners** cell: "Conversation designers, product, engineering, and research". This is a collaborators list, not a team size; the source never states one. If the "Team" label misreads it, drop it.
- **Dropped `<dl>` cell:** **Focus** — "Behavior authoring, condition building, and QA workflows". No fourth meta slot exists. The approved `summary` carries that content nearly word for word.

### Figures without captions

19 of 22 figures render with no caption, because the source gave them none — only alt text.

- `condition-tale--01` … `--13` and `--03b` — 14 exploration slides, alt "Condition stack design exploration, slide N of 14."
- `condition-tale--14` … `--18` — 5 results slides, alt "Condition stack results, slide N of 5."

The three product screenshots (QA node, message node, channel dock) kept their source figcaption text, uppercased, including the trailing "OPEN FULL SIZE TO ZOOM." — still accurate, since the full-size `href` was preserved.

### Candidate metric numbers

No metric bar was rendered, and `metric` is omitted. These numbers already exist in the source's results block, attributed to a formal study — unusual for this workspace, which is why they are surfaced rather than used. All three and the footnote are re-poured verbatim into the body prose, so nothing is lost either way.

- `17` — "IVR + digital-VA designers"
- `5.0 → 7.0` — "CSAT · +40%"
- `52.67 → 61.50` — "SUS · +8.83 points"
- Footnote, verbatim: "Three-session longitudinal study run by our embedded PhD researcher, tracking the condition stack as it was built. Both old-table-to-Session-3 gains were statistically significant at p < .05; the source deck does not report per-session completion counts."

The SUS pair is the only one already on a 0–100 scale, which is the scale `Metric.astro` draws. Whether any of these becomes a metric bar is your decision.

### Content that did not fit the template

1. **The interactive `<condition-stack-demo>` web component is gone.** The source embedded a live JS reconstruction of the nestable condition stack — the centerpiece of the Action section. Only its heading and explanatory paragraph survive ("Nestable condition blocks made the logic directly manipulable" plus the paragraph beneath). This is the single biggest loss in the re-pour. `public/work/mix-dialog/condition-stack-demo.js` and `.css` are both still on disk and now orphaned.
2. **Two horizontal scrollers became 19 stacked full-width figures.** The source rendered these as side-scrolling strips of 380×270 thumbnails ("14 condition-stack explorations · Scroll to compare →" and "Condition-stack results · Scroll to compare →"). The Action section now runs very long. The gallery labels became `###` headings; "Scroll to compare →" was dropped, since it no longer describes anything.
3. **Numbered section eyebrows dropped:** `01 · SITUATION` through `06 · EPILOGUE · 2021–2023`, plus `SCOPE`, `SYSTEM DESIGN`, `HOW I WORKED`, `INTERACTIVE RECONSTRUCTION`, `WHAT THE TEAM SAID`, `PRODUCT WORK · CONDITION STACK`. Two specific losses:
   - `06 · EPILOGUE · 2021–2023` was the only place the Verse chapter's date range appeared. The epilogue now reads as untimed.
   - `HOW I WORKED` and `SCOPE` were the only labels distinguishing those sub-blocks from the surrounding narrative.
4. **Three card grids and two numbered flow lists became bullet lists** — platform context, scope, the 01–04 action flow, the 01–04 "how I worked" flow, and the results grid. Every word kept; the eyebrow labels survive as the bolded lead of each bullet.
5. **Two callouts and one customer note became blockquotes** (spreadsheet workaround, shared-actions boundary, Sony/PS5 customer context). These were emphasis paragraphs, not quotes, and now render with quote styling.
6. **A dangling sentence carried over.** The epilogue's final sentence references "The representative slides below", but the source itself renders no slides below it. It was already dangling in the original HTML and still is.
7. **Chrome dropped:** site header, skip link, chapter nav, the "Let's make complex systems understandable." footer with its "Next: Microsoft" and "Get in touch" buttons, social footer.

### Missing or excluded assets

- All 22 referenced paths verified present under `public/` (3 PNG screenshots, 19 AVIF slides). No 404s.
- Present but unused by both the source page and the re-pour: `Condition Table Wire.png` (note the literal space in the filename) and `Mix.svg`, both in `public/work/mix-dialog/assets/media/`. The condition-table wireframe is the Microsoft-era variant; it was not on this page and was not added.
- The `testimonials-*.png` assets are not referenced by this source at all. The three quotes are inline text in the source and were re-poured as blockquotes with a role line and no names, matching the source exactly.
- `condition-stack-demo.js` / `.css` are orphaned — see item 1.

---

## Dragon Drive

### case-meta fields with no source

`role` and `timeline` render; **`team` is empty, so the meta grid shows two cells.**

- **`team` — omitted.** The source never states a team size or composition. The closest it comes is "translated that behavior for the embedded display and HUD teams" and "implementation partners" — neither is a number or a named team.
- **`role` — composed, needs your confirmation.** It renders as `Technical designer · UI + interaction lead`. The source lists four separate hero badges: `TECHNICAL DESIGNER`, `UI + INTERACTION LEAD`, `GAZE-DRIVEN HUD`, `EMBEDDED MOTION`. The two describing a role were used, the two describing the artifact dropped, and the casing changed from all caps to sentence case. This is the one field not re-poured verbatim.
- **`timeline` — `2017–2019`**, from the eyebrow `NUANCE · 2017–2019` — the same range already carried by the `org` line.

### Figures without captions

None. All three figures kept their source figcaption text, uppercased.

**Two things to check:**
- The cabin still's caption ends "Open full size to zoom." That sentence is only true if `Figure`'s `href` opens the asset in a new tab.
- `hud-hero-poster.avif` and `gaze-hud-poster.avif` are byte-identical in size (19,917 bytes each) and were written within a minute of each other. They may be the same frame duplicated — if the hero and highlight videos show the same poster, one is probably wrong.

### Candidate metric numbers

No metric bar was rendered, and `metric` is omitted. This study contains no measured result of any kind — the source is explicit that the HUD stayed a demonstration. The numbers that exist in the prose:

- "38-second excerpt from the preserved Dragon Drive car-demo footage. Press play to watch the HUD and embedded display in context." — and the same figure in an aria-label: "Thirty-eight second highlight from the Dragon Drive CES demonstration". This is the length of a video clip.
- "Four high-value domains—weather, phone, music, and navigation" — a count of widgets in a caption; a scope description, not an outcome.
- `CES 2019` and `2017–2019` are an event date and the eyebrow range.

These are numbers found in existing prose, not measurements.

### Content that did not fit the template

1. **The interaction map lost the most.** The `OCCUPANT → HUD → SYSTEM` diagram was a `role="img"` three-step arrow graphic; it is now `### The interaction sequence` and three bullets. All text survives, but the left-to-right causality is only implied by list order. Its aria-label ("Interaction sequence showing an occupant looking at a widget, the HUD confirming context, and the system interpreting a voice command") is reproduced nowhere and is now unused.
2. **Hero video overlay label dropped.** `IN-VEHICLE PROTOTYPE · CES 2019` was a span layered on the video frame and `Figure` has no slot for it. "CES 2019" survives in the showcase prose; "in-vehicle prototype" survives nowhere as a label.
3. **"Moments" card row** (Choose context / Confirm focus / Speak naturally) became three `###` subheadings with their paragraphs. The `01` / `02` / `03` numerals above each card were dropped; the "three steps" grouping is gone.
4. **Role-note aside flattened.** Its eyebrow (`THE DESIGN-ENGINEERING BRIDGE`) and its `<h3>` ("The prototype became a shared language") were merged into one heading with a colon. It reads as an ordinary subsection now, not a set-aside note.
5. **Numbered section eyebrows dropped:** `01 · THE CHALLENGE`, `02 · INTERACTION MODEL`, `03 · MY ROLE`, `04 · THE SHOWCASE`. `OUTCOME` was kept as `### Outcome`, since it is not a chapter number.
6. **Translation flow** (4 items) became four `###` headings keeping the numbering inline (`01 · Prototype`), since the sequence carries meaning. Casing changed from all caps.
7. **`<dl>` context grid** became `### Project context` plus a bold-term bullet list — four pairs, all verbatim.
8. **Callout and outcome quote both became blockquotes.** The source styled them differently (a callout vs. a pull quote); they now render identically.
9. **Deck duplication.** The hero deck sits as an unheaded lead paragraph above the hero video and is very close to the approved `summary`. If the template prints the summary as a deck, one of the two is redundant.

**Framing verified intact.** All three load-bearing disclaimers survive verbatim: "a future-facing technology demonstrator, not a production interface for someone actively driving"; "not to propose a production interface for use while a person was actively driving"; "Mercedes-Benz created its own branded interface, so the production system was not a deployment of this UI" — plus the credit-scoping sentence about the gaze technology and vehicle platform being collaborative system inputs.

### Missing or excluded assets

- All five referenced files confirmed present under `public/work/dragon-drive/assets/`: `dragon-drive-cabin.avif`, `gaze-hud-highlight.mp4`, `gaze-hud-poster.avif`, `hud-hero-loop.mp4`, `hud-hero-poster.avif`. Nothing missing.
- Not carried over as site chrome: logomark, download and social SVGs, `dragon-drive.css`, `dragon-drive.js`, and the "NEXT CASE STUDY" footer pointing at `/work/mix-dialog/`.

---

## Site-wide

### The closing line appears twice

"I make intelligent systems understandable, predictable, and useful." runs both on the home page's closing card and as the opening lead of `/about/`. You said you would rewrite one of them yourself. Noted here as a reminder — not a task for an agent.

### Dragon Drive slug mismatch

The design prototype linked the Dragon Drive card at `/work/dragon-drive-hud/`. The live site's published route is `/work/dragon-drive/`, and that is what shipped, because changing it would 404 a URL the old site already published. Flagged in case `dragon-drive-hud` was the rename you intended.

### Old site CSS and JS still ship

The old site's `styles.css` and `components/*.js` remain under `public/`, because the three experiments load them directly. They are dead weight for the new design and could be scoped down to only what the experiments actually use. A follow-up, not a blocker.

### "View additional work" currently leads to the same four

`mix-flow`, `swype` and `applause` are drafts, so the work index renders exactly
the four studies the home page already shows. The button under the home grid
still says "View additional work", and there is none — it goes to the same list
in a different layout. In the prototype the index held eight entries, which is
what made the label true.

Nothing was reworded, because that is copy and copy is yours. Three ways out:
promote a draft, change the label, or drop the button until there is a fifth
study. The count itself is computed, so it will correct on its own.

### Out of scope by decision

Listed so nothing here looks forgotten:

- The interactive homepage artifact.
- New case studies beyond the four — `mix-flow`, `swype`, and `applause` remain drafts.
- OG and social share images for the new design.
- The Copilot Studio card was deleted deliberately; that content lives inside the Microsoft study.

### Colour contrast: `--t3` misses WCAG AA in both themes

Measured from `src/styles/theme.css`, sRGB relative luminance, worst case across
the flat page colour, both `--page-grad` stops, and `--surface-2`. Nothing was
repigmented — the design system is locked and this is Erik's call.

Body text is fine. `--t1` clears 4.5:1 everywhere (14.7 dark, 14.8 light at
worst) and `--t2`, which is the actual `.prose` body colour, clears it too
(7.7 dark, 6.3 light at worst).

`--t3` does not:

| Theme | Worst ground | Ratio | Needs |
|---|---|---|---|
| Dark | `--page-grad` light stop `#10231a` | 3.63 | 4.5 |
| Dark | `--surface-2` (kbd keycaps) | 3.66 | 4.5 |
| Dark | `--page` `#070d09` | 4.33 | 4.5 |
| Light | `--page-grad` dark stop `#e6ede1` | 3.14 | 4.5 |
| Light | `--page` `#f4f6f0` | 3.44 | 4.5 |

`--t3` has no large-text exemption anywhere: it is the token for every 9.5–13px
mono label, caption, footer link, `.case-meta dt`, `.org`, and keycap. It is short
of 4.5:1 on every ground in both themes, so no part of the page rescues it. The
dark theme is the narrower miss; light is short by more than a full point.

Separately, `--line-1` (1.21–1.31) and `--line-2` (1.64–1.78) fail the 3:1
non-text threshold against every ground in both themes. That threshold applies to
controls that must be perceivable, and card borders are the only thing separating
a card from the page. The light-mode `--line-1` nudge anticipated in the migration
plan is real — but so is the dark one, and so is `--line-2`.

The focus ring passes comfortably (`--accent`, 12.9 dark / 5.6 light).
