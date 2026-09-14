/** Closed design contract: literals live in reviewed tokens, not aliases or math. */
import postcss from "postcss";
import { parse as parseAstro } from "@astrojs/compiler/sync";
import ts from "typescript";

export const TYPE_ROLES = [
  "display",
  "section",
  "title",
  "support",
  "label",
  "body",
  "body-small",
  "meta",
].map((x) => `type-${x}`);
export const JS_TOKENS = [
  "--duration",
  "--duration-slow",
  "--field-gain",
  "--stack-swap-duration",
  "--stack-easing",
  "--opacity-muted",
];
export const COMPONENTS = [
  "BaseLayout",
  "Nav",
  "Footer",
  "WorkCard",
  "CaseMeta",
  "CaseNav",
  "Figure",
  "Metric",
];
const norm = (value) =>
  value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
const refs = (value) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
const direct = (value) => /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)?.[1];
const spaceProp =
  /^(?:margin|padding|scroll-margin|scroll-padding)(?:-(?:block|inline)(?:-start|-end)?|-top|-right|-bottom|-left)?$|^(?:gap|row-gap|column-gap)$/;
const dimensionProp =
  /^(?:(?:min|max)-)?(?:width|height|inline-size|block-size)$|^(?:flex|flex-basis|column-width|text-indent)$|^grid-(?:template|auto)-(?:columns|rows)$/;
const colorProp =
  /color$|^(?:background|border-image|mask)(?:-image)?$|^(?:fill|stroke)$/;
// Only semantic bindings may vary by subtree. Primitive scales never change here.
const MUTABLE_BINDINGS = new Map([
  [
    "--accent-hue",
    new Set([
      "--accent-hue-mix",
      "--accent-hue-msft",
      "--accent-hue-drive",
      "--accent-hue-verse",
    ]),
  ],
  ["--page", new Set(["--page-dark"])],
  ["--text", new Set(["--text-dark"])],
  ["--accent-l", new Set(["--accent-l-dark"])],
  ["--accent-c", new Set(["--accent-c-dark"])],
  ["--primary", new Set(["--accent"])],
]);
const EXACT_GEOMETRY = new Set([
  // Three visible frames: available width minus the two intervening gaps.
  "src/styles/work/mix-dialog.css|.mix-media-scroller figure|width|calc((100% - var(--space-2) * 2) / 3)",
  // Switch center positions derive from its track, knob and two borders.
  "src/styles/theme.css|.switch::after|transform|translateX(calc((var(--space-4) - var(--space-1) - var(--border-width) * 2) / 2))",
  'src/styles/theme.css|[data-theme="dark"] .switch::after|transform|translateX(calc((var(--space-4) - var(--space-1) - var(--border-width) * 2) / -2))',
]);
const neutral =
  /^(?:inherit|initial|unset|revert|revert-layer|normal|auto|none|currentcolor|transparent|0)$/i;
const lengths =
  /(?<![\w-])(-?\d*\.?\d+)(px|r?em|[sld]?v[whib]|vmin|vmax|c[qwihb]+|ch|ex|cap|ic|lh|rlh|pt|pc|in|cm|mm|%)(?![\w-])/g;
function withoutVars(value) {
  let out = "",
    i = 0;
  while (i < value.length) {
    if (value.slice(i).startsWith("var(")) {
      let depth = 1;
      i += 4;
      while (i < value.length && depth) {
        if (value[i] === "(") depth++;
        if (value[i] === ")") depth--;
        i++;
      }
    } else out += value[i++];
  }
  return out;
}
function category(name, definitions, seen = new Set()) {
  if (seen.has(name)) return "cycle";
  seen.add(name);
  if (/^--space-/.test(name)) return "spacing";
  if (/^--type-/.test(name)) return "type";
  if (/^--(?:font-|display-|body$|body-small$)/.test(name))
    return "type-source";
  if (/^--track-/.test(name)) return "tracking";
  if (/^--(?:accent-hue|accent-[lc])/.test(name)) return "color-channel";
  if (/^--(?:duration|stack-.*duration)/.test(name)) return "duration";
  if (/easing/.test(name)) return "easing";
  if (/^--(?:layer-|stack-.*layer)/.test(name)) return "layer";
  if (/^--(?:opacity-|stack-glow|weight$)/.test(name)) return "opacity";
  if (/^--(?:border-width|focus-width|focus-offset|stroke-)/.test(name))
    return "stroke";
  if (/^--(?:shell|measure|target-min|stack-card-height)/.test(name))
    return "dimension";
  if (
    /^--(?:page|text|primary|accent(?:-soft)?$|line$|surface$|stack-color|stack-pigment|stack-gradient|(?:green|pink|blue|violet|teal)-)/.test(
      name,
    )
  )
    return "color";
  const values = definitions.get(name) || [];
  if (values.length && values.every((v) => direct(v))) {
    const cats = new Set(
      values.map((v) => category(direct(v), definitions, new Set(seen))),
    );
    if (cats.size === 1) return [...cats][0];
  }
  return "geometry";
}
export function tokenSnapshot(source) {
  const rows = [];
  postcss.parse(source).walkDecls((d) => {
    const scope = [];
    let p = d.parent;
    while (p && p.type !== "root") {
      scope.unshift(
        p.type === "atrule" ? `@${p.name} ${norm(p.params)}` : norm(p.selector),
      );
      p = p.parent;
    }
    rows.push([scope.join(" > "), d.prop, norm(d.value), d.important || false]);
  });
  return rows;
}
export function compareContract(source, expected) {
  const actual = tokenSnapshot(source);
  const key = (row) => JSON.stringify(row.slice(0, 2));
  const map = new Map(expected.map((row) => [key(row), row]));
  const changes = [];
  for (const row of actual) {
    const old = map.get(key(row));
    if (JSON.stringify(old) !== JSON.stringify(row))
      changes.push(
        `${old ? "changed" : "added"} ${row[0]} ${row[1]}: ${row[2]}`,
      );
    map.delete(key(row));
  }
  for (const row of map.values()) changes.push(`removed ${row[0]} ${row[1]}`);
  return changes;
}
export function scanSources(files, { contract, roles = true } = {}) {
  const violations = [];
  const tokens = files["src/styles/tokens.css"] || "";
  const definitions = new Map();
  const dormant = new Set(
    ["CaseMeta", "CaseNav", "Figure", "Metric"].filter(
      (name) =>
        !Object.values(files).some((source) =>
          new RegExp(
            `(?:import|export)[^;]*[\"'][^\"']*/${name}\\.astro[\"']`,
          ).test(source),
        ),
    ),
  );
  const push = (file, line, rule, text) =>
    violations.push({ file, line, rule, text: norm(text) });
  try {
    postcss.parse(tokens).walkDecls((d) => {
      if (d.prop.startsWith("--"))
        definitions.set(d.prop, [
          ...(definitions.get(d.prop) || []),
          norm(d.value),
        ]);
    });
  } catch (e) {
    push("src/styles/tokens.css", e.line || 1, "css-syntax", e.reason);
  }
  // These two inputs have explicit providers: case hue aliases and stack JS weight.
  definitions.set("--accent-hue", ["var(--accent-hue-mix)"]);
  definitions.set("--weight", ["0"]);
  if (contract)
    for (const change of compareContract(tokens, contract))
      push(
        "src/styles/tokens.css",
        1,
        "token-approval",
        `${change}; explicit human approval required to update scripts/token-contract.json`,
      );
  const known = (name) => definitions.has(name);
  for (const [name, values] of definitions)
    for (const value of values)
      for (const reference of refs(value))
        if (!known(reference))
          push(
            "src/styles/tokens.css",
            1,
            "token-reference",
            `${name} references missing ${reference}`,
          );
  for (const name of definitions.keys())
    if (category(name, definitions) === "cycle")
      push("src/styles/tokens.css", 1, "token-cycle", name);
  const kind = (name) => category(name, definitions);
  function css(source, file, lineOffset = 0) {
    let ast;
    try {
      ast = postcss.parse(source);
    } catch (e) {
      push(file, lineOffset + (e.line || 1), "css-syntax", e.reason);
      return;
    }
    ast.walkAtRules((a) => {
      if (a.name === "font-face")
        push(file, lineOffset + a.source.start.line, "font-face", "@font-face");
      if (a.name === "property")
        push(
          file,
          lineOffset + a.source.start.line,
          "token-provenance",
          "@property declarations belong in reviewed tokens.css",
        );
      if (
        ["media", "container"].includes(a.name) &&
        /(?:width|height|inline-size|block-size)/.test(a.params)
      ) {
        const bp = Number.parseFloat(definitions.get("--bp-mobile")?.[0]);
        const valid = [
          `(max-width:${(bp - 0.02).toFixed(2)}px)`,
          `(min-width:${bp}px)`,
        ];
        const groups = a.params.match(/\([^()]*\)/g) || [];
        if (
          groups.some(
            (x) =>
              /(?:width|height|inline-size|block-size)/.test(x) &&
              !valid.includes(x.replace(/\s/g, "")),
          )
        )
          push(
            file,
            lineOffset + a.source.start.line,
            "media",
            `@${a.name} ${a.params}`,
          );
      }
    });
    ast.walkDecls((d) => {
      const prop = d.prop.toLowerCase(),
        value = norm(d.value),
        used = refs(value),
        bare = withoutVars(value),
        line = lineOffset + d.source.start.line;
      const fail = (rule) => push(file, line, rule, `${prop}: ${value}`);
      const catOK = (cats) => used.every((n) => cats.includes(kind(n)));
      const fullBleed = [
        "calc((100% - 100cqi) / 2)",
        "calc((100cqi - 100%) / 2)",
      ];
      const exactGeometry = EXACT_GEOMETRY.has(
        `${file}|${norm(d.parent.selector || "")}|${prop}|${value}`,
      );
      let spacingValue = value;
      for (const geometry of fullBleed)
        spacingValue = spacingValue.replaceAll(geometry, "0");
      spacingValue = spacingValue.replace(
        /calc\(var\((--space-[1-7])\) \* -1\)/g,
        "var($1)",
      );
      spacingValue = spacingValue.replace(
        /calc\(var\((--space-[1-7])\) \+ env\(safe-area-inset-bottom\)\)/g,
        "var($1)",
      );
      const normalizedSpacingBare = withoutVars(spacingValue);
      for (const name of used)
        if (!known(name)) push(file, line, "token-reference", name);
      // No fallbacks: every required token is defined and fallback math hides new scales.
      if (
        /var\(\s*--[\w-]+\s*,/.test(value) &&
        !(
          file === "src/styles/prototype-card-stack.css" &&
          prop === "opacity" &&
          value === "calc(var(--stack-glow) * var(--weight,0))"
        )
      )
        fail("token-fallback");
      if (prop.startsWith("--")) {
        if (!known(prop) || !MUTABLE_BINDINGS.get(prop)?.has(direct(value)))
          fail("token-provenance");
        if (
          !direct(value) ||
          (known(prop) &&
            known(direct(value)) &&
            kind(prop) !== kind(direct(value)))
        )
          fail("token-provenance");
        return;
      }
      if (
        /^(?:font|font-family|font-size|font-weight|line-height|letter-spacing)$/.test(
          prop,
        )
      ) {
        if (
          !neutral.test(value) &&
          !(prop === "font" && direct(value)?.startsWith("--type-")) &&
          !(
            prop === "letter-spacing" &&
            direct(value) &&
            kind(direct(value)) === "tracking"
          )
        )
          fail("font");
      }
      if (spaceProp.test(prop)) {
        if (
          !catOK(["spacing", "geometry"]) ||
          /(?:calc|min|max|clamp)\(/.test(spacingValue) ||
          normalizedSpacingBare
            .split(/\s+/)
            .some(
              (v) =>
                v && !/^(?:0|auto|100%|inherit|initial|unset|normal)$/.test(v),
            )
        )
          fail("spacing");
        // Geometry aliases can position full-bleed containers, but cannot become arbitrary spacing.
        for (const n of used)
          if (kind(n) === "geometry" && n !== "--case-edge")
            fail("spacing-category");
      }
      if (dimensionProp.test(prop)) {
        if (!catOK(["spacing", "dimension", "geometry"]))
          fail("dimension-category");
        const bad = [...bare.matchAll(lengths)].some(
          (m) =>
            Number(m[1]) !== 0 &&
            !(Number(m[1]) === 100 && /^(?:%|[sld]?v[whib]|cqi)$/.test(m[2])),
        );
        if (bad) fail("dimension");
        // Any multiplication/division of spacing to mint fixed sizes is unapproved.
        if (/(?:calc|clamp)\(/.test(value) && !exactGeometry)
          fail("scale-arithmetic");
      }
      if (colorProp.test(prop)) {
        if (!catOK(["color"])) fail("color-category");
        const remainder = bare.replace(/url\([^)]*\)/g, "").trim();
        if (remainder && !neutral.test(remainder)) fail("color");
      }
      if (
        /^(?:border|outline)(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?(?:-width|-offset)?$/.test(
          prop,
        )
      ) {
        if ([...bare.matchAll(lengths)].some((m) => Number(m[1]) !== 0))
          fail("stroke");
        if (
          /(?:calc|min|max|clamp)\(/.test(value) &&
          !(
            prop === "outline-offset" &&
            value === "calc(var(--border-width) * -1)"
          )
        )
          fail("scale-arithmetic");
        if (!catOK(["color", "stroke"])) fail("stroke-category");
        if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch|color-mix)\(/i.test(bare))
          fail("color");
        const rest = bare
          .replace(/calc\([^)]*\)/g, "")
          .replace(
            /\b(?:solid|dashed|dotted|double|none|hidden|currentcolor|transparent|inherit)\b/gi,
            "",
          )
          .replace(/\b0\b/g, "")
          .trim();
        if (/[a-z]/i.test(rest) && !/[\d](?:px|em|rem)/.test(rest))
          fail("color");
      }
      if (
        /^(?:filter|backdrop-filter)$/.test(prop) &&
        !["none", "inherit", "invert(0)", "invert(1)"].includes(value)
      )
        fail("filter");
      if (
        /radius$/.test(prop) &&
        value
          .split(/[\s/]+/)
          .some((v) => !["0", "50%", "inherit", "initial", "unset"].includes(v))
      )
        fail("radius");
      if (/shadow$/.test(prop) || /drop-shadow\(/.test(value)) {
        if (!["none", "inherit"].includes(value)) fail("shadow");
      }
      if (
        /^(?:transition|animation)(?:-duration|-delay|-timing-function)?$/.test(
          prop,
        )
      ) {
        if (
          /\d*\.?\d+m?s\b|\b(?:ease|ease-in|ease-in-out|linear|cubic-bezier|steps)\b/.test(
            bare.replace(/ease-out/g, ""),
          )
        )
          fail("motion");
        if (!catOK(["duration", "easing"])) fail("motion-category");
      }
      if (
        prop === "opacity" &&
        !["0", "1", "inherit", "initial", "unset"].includes(value) &&
        !catOK(["opacity"])
      )
        fail("opacity-category");
      if (
        prop === "opacity" &&
        !["0", "1", "inherit", "initial", "unset"].includes(value) &&
        !direct(value) &&
        !(
          file === "src/styles/prototype-card-stack.css" &&
          norm(d.parent.selector || "") ===
            ".stack-prototype .stack-ambient i" &&
          value === "calc(var(--stack-glow) * var(--weight,0))"
        )
      )
        fail("opacity");
      if (
        prop === "z-index" &&
        !neutral.test(value) &&
        !used.length &&
        !(
          value === "1" &&
          d.parent.nodes.some(
            (n) => n.prop === "isolation" && n.value === "isolate",
          )
        )
      )
        fail("z-index");
      if (prop === "z-index" && !catOK(["layer"])) fail("layer-category");
      if (
        /^(?:inset(?:-.*)?|top|left|right|bottom|transform|translate|rotate|scale|perspective|transform-origin|object-position)$/.test(
          prop,
        )
      ) {
        if (!catOK(["spacing", "stroke", "dimension", "geometry"]))
          fail("geometry-category");
        const allowedNumbers =
          prop === "transform" ? [0, 90, -90, 180, -180, 360, -360] : [0];
        const bad = [
          ...bare.matchAll(/(-?\d*\.?\d+)(px|rem|em|deg|%|vh|vw|cqi)\b/g),
        ].some(
          (m) =>
            !(m[2] === "%" && [0, 50, 100, -50, -100].includes(Number(m[1]))) &&
            !allowedNumbers.includes(Number(m[1])),
        );
        const prototypeMotion =
          file === "src/styles/prototype-card-stack.css" &&
          prop === "transform";
        if (
          ["transform", "scale", "rotate"].includes(prop) &&
          !prototypeMotion
        ) {
          const geometryBare = bare
            .replace(/-?(?:90|180|360)deg\b/g, "0")
            .replace(/-?(?:50|100)%/g, "0");
          if (
            [
              ...geometryBare.matchAll(/(?<![\w-])(-?\d*\.?\d+)(?![\w.])/g),
            ].some((m) => ![-1, 0, 1].includes(Number(m[1]))) &&
            !exactGeometry
          )
            fail("geometry");
        }
        if (
          /calc\(/.test(value) &&
          !exactGeometry &&
          !prototypeMotion &&
          !fullBleed.includes(value) &&
          !/^.*calc\((?:var\(--[\w-]+\) \* -1|-1 \* var\(--[\w-]+\))\).*$/.test(
            value,
          )
        )
          fail("scale-arithmetic");
        if (bad && !prototypeMotion && !fullBleed.includes(value))
          fail("geometry");
      }
    });
  }
  function markup(source, file, lineOffset = 0) {
    let ast;
    try {
      ast = parseAstro(source).ast;
    } catch (e) {
      push(file, 1, "markup-syntax", e.message);
      return;
    }
    const visit = (node, inherited = false) => {
      const line = lineOffset + (node.position?.start.line || 1);
      const attrs = node.attributes || [];
      const classes = attrs.filter((a) =>
        ["class", "className", "class:list"].includes(a.name),
      );
      let roleCount = 0;
      for (const a of classes) {
        const names = a.value?.match(/\btype-[\w-]+\b/g) || [];
        roleCount += names.length;
        if (names.some((n) => !TYPE_ROLES.includes(n)))
          push(file, line, "type-class", names.join(" "));
        if (
          a.kind === "expression" &&
          ((names.length &&
            /(?:\+|\?|\b(?:classes|className|classNames|role)\b)/.test(
              a.value,
            )) ||
            (!names.length && /type-|\bclass(?:Name)?\b/.test(a.value)))
        )
          push(file, line, "dynamic-type-role", a.value);
      }
      if (roleCount > 1) push(file, line, "type-role-count", node.name);
      const ownsText =
        /^(?:h[1-6]|p|dt|dd|button|label|figcaption|summary|blockquote|li|th|td)$/.test(
          node.name || "",
        ) &&
        node.children?.some(
          (n) =>
            (n.type === "text" && n.value.trim()) || n.type === "expression",
        );
      if (
        roles &&
        ownsText &&
        !roleCount &&
        !dormant.has(file.match(/^src\/components\/(\w+)\.astro$/)?.[1])
      )
        push(file, line, "type-role-missing", node.name);
      for (const a of attrs) {
        if (node.name === "svg" && ["width", "height"].includes(a.name)) {
          if (a.kind === "quoted" && !["0", "100%"].includes(a.value))
            push(
              file,
              line,
              "icon-dimension",
              `${a.name}: ${a.value}; size authored icons through CSS tokens`,
            );
          if (a.kind === "expression")
            push(
              file,
              line,
              "icon-dimension",
              `${a.name}: dynamic authored icon dimensions are not an intrinsic image size`,
            );
        }
        if (["fill", "stroke", "color"].includes(a.name) && a.kind === "quoted")
          css(`x{${a.name}:${a.value}}`, file, line - 1);
      }
      for (const a of attrs)
        if (a.name === "style") {
          if (a.kind === "quoted") css(`x{${a.value}}`, file, line - 1);
          else
            push(
              file,
              line,
              "dynamic-style",
              "Use a reviewed token binding rather than an unchecked style expression",
            );
        }
      if (node.name === "style") {
        css(node.children.map((n) => n.value || "").join(""), file, line - 1);
        return;
      }
      if (node.name === "script") {
        javascript(
          node.children.map((n) => n.value || "").join(""),
          file,
          line - 1,
        );
        return;
      }
      for (const child of node.children || [])
        visit(child, inherited || roleCount === 1);
    };
    visit(ast);
  }
  function javascript(source, file, lineOffset = 0) {
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.JS,
    );
    const report = (node, rule, text) =>
      push(
        file,
        lineOffset +
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line +
          1,
        rule,
        text,
      );
    const approvedMotion = file === "src/scripts/prototype-card-stack.js";
    const allowedRead = (name) =>
      ["--duration", "--duration-slow", "--field-gain"].includes(name) ||
      (approvedMotion &&
        ["--stack-swap-duration", "--stack-easing"].includes(name)) ||
      (file === "src/scripts/egg-gesture.js" && name === "--opacity-muted");
    const durationCalls = [];
    function collectCalls(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "duration"
      )
        durationCalls.push(node);
      ts.forEachChild(node, collectCalls);
    }
    collectCalls(ast);
    const durationHelperAllowed =
      ["src/scripts/keys.js", "src/scripts/stagger.js"].includes(file) &&
      durationCalls.length > 0 &&
      durationCalls.every(
        (node) =>
          node.arguments.length === 1 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          ["--duration", "--duration-slow"].includes(node.arguments[0].text),
      );
    const accessName = (node) =>
      ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node) &&
            ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : undefined;
    const numberValue = (node) =>
      ts.isNumericLiteral(node)
        ? node.text
        : ts.isPrefixUnaryExpression(node) &&
            ts.isNumericLiteral(node.operand) &&
            [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(
              node.operator,
            )
          ? `${node.operator === ts.SyntaxKind.MinusToken ? "-" : ""}${node.operand.text}`
          : undefined;
    function visualObjectContext(node) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxAttribute(parent) && parent.name.getText(ast) === "style")
          return "jsx";
        if (
          ts.isCallExpression(parent) &&
          (accessName(parent.expression) === "animate" ||
            (ts.isIdentifier(parent.expression) &&
              parent.expression.text === "animate"))
        )
          return "animation";
        if (ts.isStatement(parent) || ts.isFunctionLike(parent)) break;
      }
      return undefined;
    }
    const isStyle = (node) =>
      node &&
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      accessName(node) === "style";
    const styleMember = (node) =>
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      isStyle(node.expression);
    function checkStyleWrite(node, name, valueNode) {
      if (!name) {
        report(
          node,
          "runtime-style",
          "Computed style property cannot be statically checked",
        );
        return;
      }
      const prop = name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      if (name === "cssText") {
        if (ts.isStringLiteralLike(valueNode))
          css(
            `x{${valueNode.text}}`,
            file,
            lineOffset +
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line,
          );
        else
          report(
            node,
            "runtime-style",
            "Dynamic cssText cannot be statically checked",
          );
        return;
      }
      if (ts.isStringLiteralLike(valueNode) && valueNode.text) {
        if (!(
          approvedMotion &&
          [
            "transform",
            "transition",
            "opacity",
            "z-index",
            "transform-origin",
          ].includes(prop)
        ))
          css(
            `x{${prop}:${valueNode.text}}`,
            file,
            lineOffset +
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line,
          );
      } else if (!["visibility", "will-change"].includes(prop)) {
        const allowed =
          (approvedMotion &&
            [
              "transform",
              "transition",
              "opacity",
              "z-index",
              "transform-origin",
            ].includes(prop)) ||
          new Set([
            // Measured canvas bounds, token-derived stagger delays, and the
            // existing sheet's measured spring position are reviewed bindings.
            'src/scripts/field.js|width|w+"px"',
            'src/scripts/field.js|height|h+"px"',
            'src/scripts/stagger.js|transition-delay|i*step+"ms"',
            "src/scripts/egg-gesture.js|transform|`translateY(${-out}px)`",
            "src/scripts/egg-gesture.js|transform|`translateY(${100-sheet.x}%)`",
            "src/scripts/egg-gesture.js|opacity|String(t*scrimMax)",
          ]).has(
            `${file}|${prop}|${valueNode.getText(ast).replace(/\s/g, " ").replace(/ /g, "").replace(/'/g, '"')}`,
          );
        if (
          !allowed &&
          !(ts.isStringLiteralLike(valueNode) && valueNode.text === "")
        )
          report(node, "runtime-style", `${prop}: ${valueNode.getText(ast)}`);
      }
    }
    function visit(n) {
      // A style object must remain visible at its use site. Passing it through
      // arbitrary aliases would require unrestricted JS data-flow analysis.
      if (isStyle(n)) {
        const parent = n.parent;
        const directMember =
          (ts.isPropertyAccessExpression(parent) ||
            ts.isElementAccessExpression(parent)) &&
          parent.expression === n;
        const directWrite = ts.isBinaryExpression(parent) && parent.left === n;
        const checkedAssign =
          ts.isCallExpression(parent) &&
          parent.expression.getText(ast) === "Object.assign" &&
          parent.arguments[0] === n;
        if (!directMember && !directWrite && !checkedAssign)
          report(
            n,
            "style-alias",
            "Style objects must use a directly checked mutation, not an indirect alias or call",
          );
      }
      if (
        ts.isCallExpression(n) &&
        accessName(n.expression) === "getPropertyValue"
      ) {
        const arg = n.arguments[0];
        if (arg && ts.isStringLiteralLike(arg) && !allowedRead(arg.text))
          report(n, "js-token", arg.text);
        else if (arg && !ts.isStringLiteralLike(arg)) {
          // Existing duration helpers enumerate both accepted names at their call sites.
          if (!durationHelperAllowed || arg.getText(ast) !== "name")
            report(n, "dynamic-token-read", n.getText(ast));
        }
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        [
          "fillStyle",
          "strokeStyle",
          "shadowColor",
          "font",
          "lineWidth",
        ].includes(accessName(n.left)) &&
        ts.isStringLiteralLike(n.right)
      ) {
        const name = accessName(n.left);
        css(
          `x{${name === "font" ? "font" : name === "lineWidth" ? "border-width" : "color"}:${n.right.text}}`,
          file,
          lineOffset + ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
        );
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        isStyle(n.left)
      )
        checkStyleWrite(n, "cssText", n.right);
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        styleMember(n.left)
      )
        checkStyleWrite(n, accessName(n.left), n.right);
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(ast) === "Object.assign" &&
        isStyle(n.arguments[0])
      ) {
        for (const argument of n.arguments.slice(1)) {
          if (!ts.isObjectLiteralExpression(argument)) {
            report(n, "runtime-style", "Dynamic Object.assign style source");
            continue;
          }
          for (const member of argument.properties) {
            if (
              ts.isPropertyAssignment(member) &&
              !ts.isComputedPropertyName(member.name)
            )
              checkStyleWrite(n, member.name.text, member.initializer);
            else
              report(
                member,
                "runtime-style",
                "Computed or spread style source",
              );
          }
        }
      }
      if (
        ts.isCallExpression(n) &&
        accessName(n.expression) === "setAttribute" &&
        n.arguments[0] &&
        ts.isStringLiteralLike(n.arguments[0]) &&
        n.arguments[0].text === "style"
      ) {
        const value = n.arguments[1];
        if (value && ts.isStringLiteralLike(value))
          css(
            `x{${value.text}}`,
            file,
            lineOffset +
              ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
          );
        else report(n, "runtime-style", "Dynamic style attribute");
      }
      if (
        ts.isCallExpression(n) &&
        accessName(n.expression) === "setProperty"
      ) {
        const [key, val] = n.arguments;
        if (!(
          approvedMotion &&
          key &&
          ts.isStringLiteralLike(key) &&
          ["--stack-pigment", "--weight"].includes(key.text)
        )) {
          if (
            key &&
            val &&
            ts.isStringLiteralLike(key) &&
            ts.isStringLiteralLike(val)
          )
            css(
              `x{${key.text}:${val.text}}`,
              file,
              lineOffset +
                ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
            );
          else report(n, "runtime-style", n.getText(ast));
        }
      }
      if (ts.isTemplateExpression(n)) {
        const template =
          n.head.text +
          n.templateSpans.map((span) => "dynamic" + span.literal.text).join("");
        if (/<(?:p|h[1-6]|button|span|label|div)\b/.test(template))
          markup(
            template,
            file,
            lineOffset +
              ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
          );
        if (
          /#[0-9a-f]{3,8}\b/i.test(template) ||
          /\b(?:rgb|hsl|oklch|color-mix)\([^)]*\d/i.test(template)
        ) {
          if (!(
            approvedMotion &&
            n.parent.getText(ast).includes("setProperty('--stack-pigment'")
          ))
            report(n, "color", template);
        }
      }
      if (ts.isPropertyAssignment(n)) {
        const context = visualObjectContext(n);
        const rawName =
          ts.isIdentifier(n.name) || ts.isStringLiteralLike(n.name)
            ? n.name.text
            : undefined;
        const prop = rawName?.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        const motionException =
          approvedMotion &&
          ["opacity", "transform", "easing", "duration", "delay"].includes(
            prop,
          );
        if (context && !rawName)
          report(
            n,
            "runtime-style",
            "Computed visual object property cannot be checked",
          );
        if (!motionException && prop) {
          const number = numberValue(n.initializer);
          const literal = ts.isStringLiteralLike(n.initializer)
            ? n.initializer.text
            : number;
          if (
            context === "animation" &&
            prop === "fill" &&
            ["none", "forwards", "backwards", "both", "auto"].includes(literal)
          ) {
            // WAAPI fill is an animation lifecycle option, not SVG fill color.
          } else if (
            context === "animation" &&
            ["duration", "delay", "easing"].includes(prop)
          ) {
            if (literal === undefined)
              report(
                n,
                "runtime-style",
                `Animation ${prop} must use a reviewed token binding`,
              );
            else
              css(
                `x{${prop === "easing" ? "transition-timing-function" : `transition-${prop}`}:${number === undefined ? literal : literal + "ms"}}`,
                file,
                lineOffset +
                  ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
              );
          } else if (context && literal !== undefined) {
            // React converts numeric lengths to pixels; WAAPI numeric opacity
            // remains unitless. Both need the same underlying CSS contract.
            const value =
              context === "jsx" &&
              number !== undefined &&
              (spaceProp.test(prop) || dimensionProp.test(prop)) &&
              Number(number) !== 0
                ? `${number}px`
                : literal;
            css(
              `x{${prop}:${value}}`,
              file,
              lineOffset +
                ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
            );
          } else if (
            context &&
            [
              "opacity",
              "transform",
              "color",
              "background",
              "font",
              "font-size",
            ].includes(prop) &&
            literal === undefined
          ) {
            report(
              n,
              "runtime-style",
              `${prop} uses an unchecked dynamic visual value`,
            );
          } else if (
            !context &&
            /^(?:padding|margin|color|background|font-size|font|border|opacity|transform)$/.test(
              prop,
            ) &&
            ts.isStringLiteralLike(n.initializer)
          ) {
            css(
              `x{${prop}:${n.initializer.text}}`,
              file,
              lineOffset +
                ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
            );
          }
        }
      }
      if (ts.isStringLiteralLike(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (
          /#[0-9a-f]{3,8}\b/i.test(n.text) ||
          /\b(?:rgb|hsl|oklch|color-mix)\([^)]*\d/i.test(n.text)
        )
          report(n, "color", n.text);
        if (/<(?:p|h[1-6]|button|span|label|div)\b/.test(n.text))
          markup(
            n.text,
            file,
            lineOffset +
              ast.getLineAndCharacterOfPosition(n.getStart(ast)).line,
          );
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  for (const [file, source] of Object.entries(files)) {
    if (file.split("/").includes(".archive")) continue;
    if (file.startsWith("public/")) {
      if (/\.(?:css|[cm]?[jt]sx?|html|astro|mdx)$/.test(file))
        push(file, 1, "public-code", file);
      continue;
    }
    if (!file.startsWith("src/")) continue;
    source.split("\n").forEach((s, i) => {
      if (/crimson/i.test(s)) push(file, i + 1, "crimson", s);
    });
    if (file === "src/styles/tokens.css") continue;
    if (
      /^src\/(?:components|layouts)\/.*\.(?:astro|jsx|tsx)$/.test(file) &&
      ![
        "src/layouts/BaseLayout.astro",
        ...COMPONENTS.filter((n) => n !== "BaseLayout").map(
          (n) => `src/components/${n}.astro`,
        ),
      ].includes(file)
    )
      push(
        file,
        1,
        "component-registry",
        "New components require explicit approval",
      );
    if (file.endsWith(".css")) css(source, file);
    else if (/\.(?:astro|mdx|html)$/.test(file)) markup(source, file);
    else if (/\.[cm]?[jt]sx?$/.test(file)) {
      javascript(source, file);
      if (/\.[jt]sx$/.test(file)) markup(source, file);
    }
  }
  return violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule),
  );
}
