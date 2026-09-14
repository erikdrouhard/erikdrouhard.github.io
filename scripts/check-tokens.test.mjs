/** Adversarial, in-memory fixtures. Tests never create or delete source files. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  scanSources,
  scanTree,
  main,
  serializeSeed,
  readSeed,
  compareToSeed,
} from "./check-tokens.mjs";
import { tokenSnapshot, compareContract } from "./token-policy.mjs";
const root = new URL("../", import.meta.url).pathname;
const TOKENS = `:root {
 --font-primary: serif; --body: 400 16px/1.4 var(--font-primary);
 --type-body: var(--body); --type-title: var(--body); --type-meta: var(--body);
 --track-caps: .08em; --space-1: 12px; --space-2:16px; --space-3:20px; --space-4:36px; --space-5:54px; --space-6:72px; --space-7:112px;
 --gutter:var(--space-4); --case-gutter:var(--space-3); --case-inset:var(--space-3);
 --case-edge:max(var(--case-gutter),calc((100cqi - var(--shell))/2 + var(--case-gutter)));
 --shell:1000px; --measure:68ch; --target-min:44px;
 --text:#000; --text-dark:#fff; --page:#fff; --page-dark:#070d09; --primary:#16713d; --line:var(--text); --accent:var(--primary); --accent-hue-mix:283.82;
 --duration:150ms; --duration-slow:450ms; --bp-mobile:810px;
 --layer-sticky:1; --border-width:1px; --focus-width:2px; --focus-offset:2px;
 --opacity-disabled:.34; --stack-swap-duration:480ms; --stack-easing:cubic-bezier(.22,.61,.36,1);
 --stack-glow:.28;
}`;
const scan = (files, options = {}) =>
  scanSources({ "src/styles/tokens.css": TOKENS, ...files }, options);
const css = (source) => scan({ "src/styles/a.css": source });
const rules = (found) => found.map((v) => v.rule);
const fails = (source, rule) =>
  assert.ok(rules(css(source)).includes(rule), JSON.stringify(css(source)));
const passes = (source) => assert.deepEqual(css(source), []);

test("approved type, spacing, alias, width, color and stroke contracts pass", () => {
  passes(
    ".x{font:var(--type-body);letter-spacing:var(--track-caps);padding:var(--space-1) var(--gutter);width:100%;max-width:var(--shell);color:var(--text);border:var(--border-width) solid var(--line)}",
  );
  passes(".dark{--page:var(--page-dark);--text:var(--text-dark)}");
});
test("type shorthand requires a type role, not arbitrary variables or sources", () => {
  for (const value of ["18px serif", "var(--space-1)", "var(--body)"])
    fails(`.x{font:${value}}`, "font");
  for (const prop of ["font-size", "font-weight", "line-height", "font-family"])
    fails(`.x{${prop}:var(--type-body)}`, "font");
});
test("unknown references, literal fallbacks, alias laundering and wrong categories fail", () => {
  fails(".x{padding:var(--missing,13px)}", "token-reference");
  fails(".x{padding:var(--space-1,13px)}", "token-fallback");
  fails(
    ".x{--private-gap:13px;padding:var(--private-gap)}",
    "token-provenance",
  );
  fails(".x{--space-1:var(--text)}", "token-provenance");
  fails(".x{padding:var(--text)}", "spacing");
  fails(".x{color:var(--space-1)}", "color-category");
});
test("full stylesheet parsing catches multiline declarations, nested rules and media", () => {
  fails(".x{padding:\n13px; & span { inline-size:13px }}", "spacing");
  fails(".x{padding:\n13px; & span { inline-size:13px }}", "dimension");
  fails("@media\n(max-width:\n777px){.x{color:var(--text)}}", "media");
  assert.equal(css(".x{\n\npadding:\n13px}")[0].line, 3);
});
test("breakpoint literals derive from the actual breakpoint token", () => {
  passes(
    "@media(max-width:809.98px){.x{padding:0}} @media(min-width:810px){.x{padding:0}}",
  );
  const result = scan({
    "src/styles/tokens.css": TOKENS.replace(
      "--bp-mobile:810px",
      "--bp-mobile:900px",
    ),
    "src/styles/a.css": "@media(min-width:810px){.x{padding:0}}",
  });
  assert.ok(rules(result).includes("media"));
});
test("logical dimensions, flex bases, grid tracks and newer CSS units are enforced", () => {
  for (const prop of [
    "inline-size",
    "block-size",
    "min-inline-size",
    "max-block-size",
    "flex-basis",
    "grid-template-columns",
  ])
    for (const unit of ["px", "cqw", "dvh", "rlh"])
      fails(`.x{${prop}:13${unit}}`, "dimension");
  passes(
    ".x{grid-template-columns:repeat(3,minmax(0,1fr));height:100dvh;inline-size:100%;aspect-ratio:723/550}",
  );
});
test("arithmetic cannot create micro spacing or new fixed dimensions", () => {
  for (const value of [
    "calc(var(--space-1)/2)",
    "calc(var(--space-1) + var(--space-2))",
    "clamp(0px,var(--space-1),var(--space-2))",
  ])
    fails(`.x{padding:${value}}`, "spacing");
  fails(".x{width:calc(var(--space-1)*5)}", "scale-arithmetic");
  passes(
    ".x{margin-inline:calc((100% - 100cqi) / 2);padding-bottom:calc(var(--space-4) + env(safe-area-inset-bottom))}",
  );
});
test("all CSS color derivations and named colors are rejected outside tokens", () => {
  for (const value of [
    "#fff",
    "rebeccapurple",
    "aliceblue",
    "CanvasText",
    "rgb(1 2 3)",
    "color-mix(in srgb,var(--text) 43%,var(--page))",
    "oklch(from var(--text) .7 c h)",
  ])
    fails(`.x{color:${value}}`, "color");
  passes(".x{color:inherit;background:transparent;fill:currentColor}");
});
test("border and focus geometry cannot use raw widths or offsets", () => {
  fails(".x{border:3px solid var(--line)}", "stroke");
  fails(".x{outline-offset:7px}", "stroke");
  passes(
    ".x{outline:var(--focus-width) solid var(--primary);outline-offset:var(--focus-offset)}",
  );
});
test("circles, endpoint opacity and geometric quarter turns are explicit exceptions", () => {
  passes(".x{border-radius:50%;opacity:0;transform:rotate(90deg)}");
  fails(".x{border-radius:4px}", "radius");
  fails(".x{opacity:.43}", "opacity");
  fails(".x{transform:translateY(13px)}", "geometry");
});
test("shadows, font face, Crimson and motion literals remain prohibited", () => {
  fails(".x{box-shadow:0 1px 2px var(--text)}", "shadow");
  fails("@font-face{font-family:x;src:url(x)}", "font-face");
  fails('.x{font-family:"Crimson Text"}', "crimson");
  fails(".x{transition:color 150ms ease-out}", "motion");
  fails(".x{transition:color var(--duration) linear}", "motion");
  passes(".x{transition:color var(--duration) ease-out}");
});
test("local numeric layering requires isolation and only permits layer one", () => {
  passes(".x{isolation:isolate;z-index:1}");
  fails(".x{z-index:1}", "z-index");
  fails(".x{isolation:isolate;z-index:40}", "z-index");
});
test("Astro and HTML inline style attributes are parsed as declarations", () => {
  for (const ext of ["astro", "html", "mdx"])
    assert.ok(
      rules(
        scan({
          [`src/pages/a.${ext}`]:
            '<p class="type-body" style="padding:\n13px">Hi</p>',
        }),
      ).includes("spacing"),
    );
  assert.ok(
    rules(
      scan({
        "src/pages/a.astro": '<p class="type-body" style={styles}>Hi</p>',
      }),
    ).includes("dynamic-style"),
  );
});
test("type owners need one role; inline descendants can inherit", () => {
  assert.deepEqual(
    scan({
      "src/pages/a.astro": '<p class="type-body">Hi <strong>there</strong></p>',
    }),
    [],
  );
  assert.ok(
    rules(scan({ "src/pages/a.astro": "<p>Hi</p>" })).includes(
      "type-role-missing",
    ),
  );
  assert.ok(
    rules(
      scan({ "src/pages/a.astro": '<p class="type-body type-title">Hi</p>' }),
    ).includes("type-role-count"),
  );
  assert.ok(
    rules(
      scan({ "src/pages/a.astro": '<p class="type-made-up">Hi</p>' }),
    ).includes("type-class"),
  );
});
test("new components require approval, dormant role omissions are checked on import", () => {
  assert.ok(
    rules(
      scan({ "src/components/New.astro": '<p class="type-body">Hi</p>' }),
    ).includes("component-registry"),
  );
  assert.deepEqual(
    scan({ "src/components/Figure.astro": "<figcaption>Caption</figcaption>" }),
    [],
  );
  assert.ok(
    rules(
      scan({
        "src/components/Figure.astro": "<figcaption>Caption</figcaption>",
        "src/pages/a.astro":
          '---\nimport Figure from "../components/Figure.astro";\n---\n<Figure />',
      }),
    ).includes("type-role-missing"),
  );
});
test("JS, JSX and TSX style writes cannot bypass value enforcement", () => {
  for (const ext of ["js", "jsx", "tsx"])
    assert.ok(
      rules(
        scan({ [`src/scripts/a.${ext}`]: 'element.style.padding="13px";' }),
      ).includes("spacing"),
    );
  assert.ok(
    rules(
      scan({
        "src/components/New.tsx":
          'export const X=()=> <p style={{padding:"13px"}}>Hi</p>',
      }),
    ).includes("spacing"),
  );
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": "element.style.padding=arbitrary;" }),
    ).includes("runtime-style"),
  );
});
test("runtime exemptions are restricted to named file and property pairs", () => {
  assert.deepEqual(
    scan({
      "src/scripts/prototype-card-stack.js":
        'element.style.transform="translateX(18px)";',
    }),
    [],
  );
  assert.ok(
    rules(
      scan({
        "src/scripts/prototype-card-stack.js": 'element.style.padding="13px";',
      }),
    ).includes("spacing"),
  );
  assert.ok(
    rules(
      scan({
        "src/scripts/a.js": 'element.style.transform="translateX(18px)";',
      }),
    ).includes("geometry"),
  );
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": 'cs.getPropertyValue("--accent");' }),
    ).includes("js-token"),
  );
  assert.deepEqual(
    scan({
      "src/scripts/prototype-card-stack.js":
        'cs.getPropertyValue("--stack-swap-duration");cs.getPropertyValue("--stack-easing");',
    }),
    [],
  );
});
test("generated template markup enforces roles", () => {
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": "const html=`<p>${name}</p>`;" }),
    ).includes("type-role-missing"),
  );
});
test("public code is rejected while archived assets are skipped", () => {
  assert.ok(rules(scan({ "public/a.js": "x" })).includes("public-code"));
  assert.deepEqual(
    scan({ "public/.archive/a.js": "x", "public/assets/a.svg": "<svg/>" }),
    [],
  );
});
test("token snapshot catches added names, changed values and scope changes", () => {
  const contract = tokenSnapshot(TOKENS);
  assert.deepEqual(compareContract(TOKENS, contract), []);
  for (const changed of [
    TOKENS.replace("12px", "13px"),
    TOKENS + "\n:root{--new-space:13px}",
    TOKENS.replace(":root", ".new-scope"),
  ])
    assert.ok(compareContract(changed, contract).length);
  assert.ok(
    rules(
      scan(
        { "src/styles/tokens.css": TOKENS.replace("12px", "13px") },
        { contract },
      ),
    ).includes("token-approval"),
  );
});
test("tokens themselves must reference existing definitions", () => {
  assert.ok(
    rules(
      scan({
        "src/styles/tokens.css": TOKENS + "\n:root{--alias:var(--missing)}",
      }),
    ).includes("token-reference"),
  );
});
test("legacy seed comparison still detects extra counts and stale entries", () => {
  const violation = { file: "src/a.css", line: 1, rule: "color", text: "#fff" };
  const seed = readSeed(serializeSeed([violation]));
  assert.equal(compareToSeed([violation], seed).ok, true);
  assert.equal(compareToSeed([violation, violation], seed).ok, false);
  assert.equal(compareToSeed([], seed).ok, false);
});
test("--write cannot bless new violations or token changes", () =>
  assert.equal(main(["--write"]), 1));
test("real source matches the reviewed contract with no seed exemptions", () => {
  assert.deepEqual(
    readSeed(
      readFileSync(new URL("./token-violations.txt", import.meta.url), "utf8"),
    ),
    [],
  );
  const found = scanTree(root);
  assert.deepEqual(
    found,
    [],
    found.map((v) => `${v.file}:${v.line} ${v.rule} ${v.text}`).join("\n"),
  );
});

test("primitive scales cannot be rebound locally, even to another valid scale token", () => {
  for (const declaration of [
    "--space-1:var(--space-2)",
    "--type-body:var(--type-title)",
    "--opacity-disabled:var(--opacity-muted)",
    "--border-width:var(--focus-width)",
  ])
    fails(`.x{${declaration}}`, "token-provenance");
});
test("opacity and stroke arithmetic cannot synthesize intermediate values", () => {
  fails(".x{opacity:calc(var(--opacity-disabled)*.99)}", "opacity");
  fails(".x{border-width:calc(var(--border-width)*3)}", "scale-arithmetic");
});
test("a percentage does not excuse unrelated token arithmetic", () => {
  for (const expression of [
    "calc(100% + var(--space-1)/7)",
    "min(calc(var(--shell)/3),100%)",
    "calc((100% - var(--space-2)*2)/3)",
  ])
    fails(`.x{width:${expression}}`, "scale-arithmetic");
});
test("authored icon dimensions are controlled while intrinsic image attributes remain valid", () => {
  assert.ok(
    rules(
      scan({
        "src/pages/a.astro":
          '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M0 0" /></svg>',
      }),
    ).includes("icon-dimension"),
  );
  assert.deepEqual(
    scan({
      "src/pages/a.astro":
        '<img width="723" height="550" src="a.png" alt="" />',
    }),
    [],
  );
});
test("nontrivial transform scale is not a geometry exception", () => {
  fails(".x{transform:scale(.95)}", "geometry");
  fails(".x{transform:translate(var(--text))}", "geometry-category");
  passes(".x{transform:scale(1)}");
});
test("computed style properties, cssText, Object.assign and style attributes are checked", () => {
  for (const source of [
    'element.style["padding"]="13px";',
    'element["style"].padding="13px";',
    'element.style.cssText="padding:13px";',
    'Object.assign(element.style,{padding:"13px"});',
    'element.setAttribute("style","padding:13px");',
  ])
    assert.ok(
      rules(scan({ "src/scripts/a.js": source })).includes("spacing"),
      source,
    );
  for (const source of [
    "element.style[property]=value;",
    "element.style.cssText=value;",
    "Object.assign(element.style,styles);",
    'element.setAttribute("style",styles);',
  ])
    assert.ok(
      rules(scan({ "src/scripts/a.js": source })).includes("runtime-style"),
      source,
    );
});
test("runtime token exceptions are scoped and duration helpers cannot read new tokens", () => {
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": 'cs.getPropertyValue("--stack-easing");' }),
    ).includes("js-token"),
  );
  assert.ok(
    rules(
      scan({
        "src/scripts/keys.js":
          'function duration(name){return cs.getPropertyValue(name)};duration("--text");',
      }),
    ).includes("dynamic-token-read"),
  );
  assert.deepEqual(
    scan({
      "src/scripts/keys.js":
        'function duration(name){return cs.getPropertyValue(name)};duration("--duration");',
    }),
    [],
  );
});

test("CSS comments cannot hide missing references or literal fallbacks", () => {
  fails(".x{padding:var(/* hidden */--missing)}", "token-reference");
  fails(".x{padding:var(--space-1 /* hidden */,13px)}", "token-fallback");
});
test("shorthand dimensions and standalone transform properties follow the same scale rules", () => {
  fails(".x{flex:0 0 13px}", "dimension");
  fails(".x{scale:.95}", "geometry");
  fails(".x{filter:opacity(.43)}", "filter");
  fails(".x{scroll-padding:13px}", "spacing");
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": 'element.style="padding:13px";' }),
    ).includes("spacing"),
  );
});

test("measured runtime exceptions do not permit new authored transforms or colors", () => {
  assert.ok(
    rules(
      scan({
        "src/scripts/egg-gesture.js":
          "element.style.transform=`translateY(${amount*13}px)`;",
      }),
    ).includes("runtime-style"),
  );
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": 'ctx.fillStyle="rebeccapurple";' }),
    ).includes("color"),
  );
  assert.ok(
    rules(
      scan({ "src/scripts/a.js": 'cs["getPropertyValue"]("--accent");' }),
    ).includes("js-token"),
  );
});

test("style object aliases and arbitrary mutation helpers fail closed", () => {
  for (const source of [
    'const s=element.style;s.padding="13px";',
    "mutate(element.style);",
    "const get=()=>element.style;",
  ])
    assert.ok(
      rules(scan({ "src/scripts/a.js": source })).includes("style-alias"),
    );
});

test("removed canvas RGB token is no longer an allowed runtime read", () => {
  assert.ok(
    rules(
      scan({ "src/scripts/field.js": 'cs.getPropertyValue("--field-rgb");' }),
    ).includes("js-token"),
  );
});
test("numeric WAAPI values and timings require approved motion scope", () => {
  const source =
    'element.animate([{opacity:.3},{opacity:1}],{duration:333,easing:"ease-out"});';
  const found = rules(scan({ "src/scripts/a.js": source }));
  assert.ok(found.includes("opacity"));
  assert.ok(found.includes("motion"));
  assert.deepEqual(scan({ "src/scripts/prototype-card-stack.js": source }), []);
  assert.deepEqual(
    scan({
      "src/scripts/a.js":
        "const simulation={opacity:.3,duration:333,stiffness:450};",
    }),
    [],
  );
});
test("numeric JSX style values cannot bypass CSS token categories", () => {
  const found = rules(
    scan({
      "src/pages/a.tsx":
        'export const Example=()=> <p className="type-body" style={{opacity:.3,padding:13}}>Hi</p>;',
    }),
  );
  assert.ok(found.includes("opacity"));
  assert.ok(found.includes("spacing"));
});
