const SPACING_TOKENS = [
  { name: "spacingHorizontalXS", value: 4 },
  { name: "spacingHorizontalS", value: 8 },
  { name: "spacingHorizontalM", value: 12 },
  { name: "spacingHorizontalL", value: 16 },
  { name: "spacingHorizontalXL", value: 20 },
  { name: "spacingHorizontalXXL", value: 24 },
  { name: "spacingHorizontalXXXL", value: 32 },
];

const RADIUS_TOKENS = [
  { name: "borderRadiusNone", value: 0 },
  { name: "borderRadiusSmall", value: 2 },
  { name: "borderRadiusMedium", value: 4 },
  { name: "borderRadiusLarge", value: 6 },
  { name: "borderRadiusXLarge", value: 8 },
  { name: "borderRadiusCircular", value: 10000 },
];

const STROKE_TOKENS = [
  { name: "strokeWidthThin", value: 1 },
  { name: "strokeWidthThick", value: 2 },
  { name: "strokeWidthThicker", value: 3 },
  { name: "strokeWidthThickest", value: 4 },
];

const SHADOW_TOKENS = [
  { name: "shadow2", light: "0 0 2px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.14)", dark: "0 0 2px rgba(0,0,0,.24), 0 1px 2px rgba(0,0,0,.28)" },
  { name: "shadow4", light: "0 0 2px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.14)", dark: "0 0 2px rgba(0,0,0,.24), 0 2px 4px rgba(0,0,0,.28)" },
  { name: "shadow8", light: "0 0 2px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.14)", dark: "0 0 2px rgba(0,0,0,.24), 0 4px 8px rgba(0,0,0,.28)" },
  { name: "shadow16", light: "0 0 2px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.14)", dark: "0 0 2px rgba(0,0,0,.24), 0 8px 16px rgba(0,0,0,.28)" },
  { name: "shadow28", light: "0 0 8px rgba(0,0,0,.12), 0 14px 28px rgba(0,0,0,.14)", dark: "0 0 8px rgba(0,0,0,.24), 0 14px 28px rgba(0,0,0,.28)" },
  { name: "shadow64", light: "0 0 8px rgba(0,0,0,.12), 0 32px 64px rgba(0,0,0,.14)", dark: "0 0 8px rgba(0,0,0,.24), 0 32px 64px rgba(0,0,0,.28)" },
];

const MOTION_TOKENS = [
  { name: "durationUltraFast", value: 50 },
  { name: "durationFaster", value: 100 },
  { name: "durationFast", value: 150 },
  { name: "durationNormal", value: 200 },
  { name: "durationSlow", value: 300 },
  { name: "durationSlower", value: 400 },
  { name: "durationUltraSlow", value: 500 },
];

const TYPE_TOKENS = {
  caption1: { size: 10, line: 14, weight: 400 },
  body1: { size: 12, line: 16, weight: 400 },
  subtitle2: { size: 14, line: 20, weight: 400 },
  body2: { size: 16, line: 22, weight: 400 },
  subtitle1: { size: 20, line: 28, weight: 300 },
  title2: { size: 28, line: 36, weight: 300 },
};

const THEMES = {
  light: {
    label: "Verse light",
    canvas: "#fafafa",
    surface: "#ffffff",
    surfaceAlt: "#fafafa",
    foreground: "#242424",
    muted: "#424242",
    stroke: "#d1d1d1",
  },
  dark: {
    label: "Verse dark",
    canvas: "#1f1f1f",
    surface: "#292929",
    surfaceAlt: "#1f1f1f",
    foreground: "#ffffff",
    muted: "#d6d6d6",
    stroke: "#666666",
  },
  contrast: {
    label: "Verse high contrast",
    canvas: "#000000",
    surface: "#000000",
    surfaceAlt: "#000000",
    foreground: "#ffffff",
    muted: "#ffffff",
    stroke: "#ffffff",
  },
};

const ACCENT_TOKENS = {
  brand: {
    name: "colorBrandBackground",
    light: "#0f6cbd",
    dark: "#115ea3",
    contrast: "#000000",
  },
  "teal-neptune": {
    name: "colorVerseBrandGradientsTealToNeptune",
    light: "linear-gradient(#68CEDB, #2265E0)",
    dark: "linear-gradient(#68CEDB, #2265E0)",
    contrast: "linear-gradient(#68CEDB, #2265E0)",
    solid: "#2265E0",
  },
  neptune: {
    name: "colorVerseBrandGradientsNeptuneDkToNeptune",
    light: "linear-gradient(#0D2653, #2266E3)",
    dark: "linear-gradient(#2265E0, #B4D6FA)",
    contrast: "linear-gradient(#2265E0, #B4D6FA)",
    solid: "#2265E0",
  },
  "tag-blue": {
    name: "colorVerseTagBlueBackground",
    light: "#0078D4",
    dark: "#D0E7F8",
    contrast: "#000000",
  },
  "tag-green": {
    name: "colorVerseTagGreenBackground",
    light: "#107C10",
    dark: "#C9EAC9",
    contrast: "#000000",
  },
  "tag-magenta": {
    name: "colorVerseTagMagentaBackground",
    light: "#BF0077",
    dark: "#F5CEE6",
    contrast: "#000000",
  },
};

const state = {
  space: 3,
  radius: 3,
  stroke: 0,
  shadow: 2,
  motion: 3,
  accent: "brand",
  typography: "body2",
  theme: "light",
  layout: "orbit",
  count: 6,
  tilt: 4,
  remix: 0,
};

const canvas = document.querySelector("#token-canvas");
const nodeLayer = canvas.querySelector(".node-layer");
const connectorLayer = canvas.querySelector(".connector-layer");
const form = document.querySelector("#token-controls");
const status = document.querySelector("#change-status");

const controls = {
  space: document.querySelector("#space-token"),
  radius: document.querySelector("#radius-token"),
  stroke: document.querySelector("#stroke-token"),
  shadow: document.querySelector("#shadow-token"),
  motion: document.querySelector("#motion-token"),
  accent: document.querySelector("#accent-token"),
  typography: document.querySelector("#type-token"),
  count: document.querySelector("#count-control"),
  tilt: document.querySelector("#tilt-control"),
};

function tokenLabel(token) {
  return `${token.name} · ${token.value}px`;
}

function spacingLabel(token) {
  const verticalName = token.name.replace("Horizontal", "Vertical");
  return `${token.name} / ${verticalName} · ${token.value}px`;
}

function accentValue(token, theme) {
  return token[theme];
}

function solidAccent(token, value) {
  if (token.solid) return token.solid;
  return value.startsWith("#") ? value : "#2265E0";
}

function readableText(value) {
  if (!value.startsWith("#") || value.length !== 7) return "#ffffff";
  const red = Number.parseInt(value.slice(1, 3), 16);
  const green = Number.parseInt(value.slice(3, 5), 16);
  const blue = Number.parseInt(value.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 156 ? "#000000" : "#ffffff";
}

function remixOffset(index, axis) {
  const value = Math.sin((index + 1) * (state.remix + 3) * (axis + 1) * 12.9898) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 5;
}

function positionsForLayout() {
  const positions = [];

  if (state.layout === "orbit") {
    for (let index = 0; index < state.count; index += 1) {
      const angle = (Math.PI * 2 * index) / state.count - Math.PI / 2;
      positions.push({
        x: 50 + Math.cos(angle) * 33 + remixOffset(index, 0),
        y: 50 + Math.sin(angle) * 31 + remixOffset(index, 1),
        angle: Math.sin(angle) * state.tilt,
        scale: index === 0 ? 1.06 : 1,
      });
    }
    return positions;
  }

  if (state.layout === "flow") {
    const columns = state.count > 6 ? 4 : 3;
    const rows = Math.ceil(state.count / columns);
    for (let index = 0; index < state.count; index += 1) {
      const row = Math.floor(index / columns);
      const columnInRow = index % columns;
      const column = row % 2 ? columns - columnInRow - 1 : columnInRow;
      positions.push({
        x: 15 + (column * 70) / Math.max(columns - 1, 1) + remixOffset(index, 0),
        y: 20 + (row * 60) / Math.max(rows - 1, 1) + remixOffset(index, 1),
        angle: (index % 2 ? 1 : -1) * state.tilt,
        scale: index === state.count - 1 ? 1.06 : 1,
      });
    }
    return positions;
  }

  const spread = Math.min(6, 38 / state.count);
  for (let index = 0; index < state.count; index += 1) {
    const offset = index - (state.count - 1) / 2;
    positions.push({
      x: 50 + offset * spread + remixOffset(index, 0) * 0.4,
      y: 50 + offset * spread * 0.75 + remixOffset(index, 1) * 0.4,
      angle: offset * (state.tilt / Math.max(state.count - 1, 1)),
      scale: 1 - Math.abs(offset) * 0.012,
    });
  }
  return positions;
}

function renderConnectors(positions) {
  connectorLayer.replaceChildren();
  const connections = positions.map((position, index) => [position, positions[index + 1]]);
  if (state.layout === "orbit") connections[connections.length - 1][1] = positions[0];

  connections.forEach(([from, to]) => {
    if (!to) return;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    connectorLayer.append(line);
  });
}

function renderNodes(positions) {
  nodeLayer.replaceChildren();
  const nodes = [];
  positions.forEach((position, index) => {
    const node = document.createElement("div");
    node.className = "pattern-node";
    if (index === 0 || (state.layout === "flow" && index === state.count - 1)) node.classList.add("is-accent");
    if (index % 3 === 2) node.classList.add("is-secondary");
    node.style.setProperty("--node-x", `${position.x}%`);
    node.style.setProperty("--node-y", `${position.y}%`);
    node.style.setProperty("--node-angle", `${position.angle}deg`);
    node.style.setProperty("--node-scale", position.scale);
    node.style.setProperty("--node-layer", state.layout === "stack" ? index + 2 : 2);
    node.style.setProperty("--meter-width", `${42 + ((index * 13 + state.remix * 7) % 48)}%`);
    node.innerHTML = `
      <div class="node-chrome"><i></i><i></i><i></i></div>
      <p class="node-title">Pattern ${String(index + 1).padStart(2, "0")}</p>
      <div class="node-meter"></div>
      <span class="node-tag">${index % 2 ? "system" : "token"}</span>
    `;
    nodeLayer.append(node);
    nodes.push(node);
  });

  const canvasRect = canvas.getBoundingClientRect();
  return positions.map((position, index) => {
    const nodeRect = nodes[index].getBoundingClientRect();
    const safeX = ((nodeRect.width / 2 + 10) / canvasRect.width) * 100;
    const safeY = ((nodeRect.height / 2 + 10) / canvasRect.height) * 100;
    const constrained = {
      ...position,
      x: Math.min(100 - safeX, Math.max(safeX, position.x)),
      y: Math.min(100 - safeY, Math.max(safeY, position.y)),
    };
    nodes[index].style.setProperty("--node-x", `${constrained.x}%`);
    nodes[index].style.setProperty("--node-y", `${constrained.y}%`);
    return constrained;
  });
}

function updateOutputs() {
  const space = SPACING_TOKENS[state.space];
  const radius = RADIUS_TOKENS[state.radius];
  const stroke = STROKE_TOKENS[state.stroke];
  const shadow = SHADOW_TOKENS[state.shadow];
  const motion = MOTION_TOKENS[state.motion];
  const accent = ACCENT_TOKENS[state.accent];
  const theme = THEMES[state.theme];
  const currentAccentValue = accentValue(accent, state.theme);

  document.querySelector("#space-output").value = spacingLabel(space);
  document.querySelector("#radius-output").value = tokenLabel(radius);
  document.querySelector("#stroke-output").value = tokenLabel(stroke);
  document.querySelector("#shadow-output").value = shadow.name;
  document.querySelector("#motion-output").value = `${motion.name} · ${motion.value}ms`;
  document.querySelector("#count-output").value = state.count;
  document.querySelector("#tilt-output").value = `${state.tilt}°`;

  document.querySelector("#readout-space").textContent = spacingLabel(space);
  document.querySelector("#readout-radius").textContent = tokenLabel(radius);
  document.querySelector("#readout-surface").textContent = `colorNeutralBackground1 · ${theme.surface}`;
  document.querySelector("#readout-accent").textContent = `${accent.name} · ${currentAccentValue}`;
}

function render(announce = true) {
  const space = SPACING_TOKENS[state.space];
  const radius = RADIUS_TOKENS[state.radius];
  const stroke = STROKE_TOKENS[state.stroke];
  const shadow = SHADOW_TOKENS[state.shadow];
  const motion = MOTION_TOKENS[state.motion];
  const type = TYPE_TOKENS[state.typography];
  const theme = THEMES[state.theme];
  const accent = ACCENT_TOKENS[state.accent];
  const currentAccentValue = accentValue(accent, state.theme);
  const accentSolid = solidAccent(accent, currentAccentValue);

  canvas.dataset.theme = state.theme;
  canvas.style.setProperty("--token-spacing", `${space.value}px`);
  canvas.style.setProperty("--token-radius", `${radius.value}px`);
  canvas.style.setProperty("--token-stroke", `${stroke.value}px`);
  canvas.style.setProperty("--token-shadow", state.theme === "light" ? shadow.light : shadow.dark);
  canvas.style.setProperty("--motion-duration", `${motion.value}ms`);
  canvas.style.setProperty("--canvas-surface", theme.canvas);
  canvas.style.setProperty("--node-surface", theme.surface);
  canvas.style.setProperty("--node-surface-alt", theme.surfaceAlt);
  canvas.style.setProperty("--node-foreground", theme.foreground);
  canvas.style.setProperty("--node-muted", theme.muted);
  canvas.style.setProperty("--node-stroke", theme.stroke);
  canvas.style.setProperty("--token-accent", currentAccentValue);
  canvas.style.setProperty("--token-accent-solid", accentSolid);
  canvas.style.setProperty("--token-on-accent", readableText(accentSolid));
  canvas.style.setProperty("--font-node-size", `${type.size}px`);
  canvas.style.setProperty("--font-node-line-height", `${type.line / type.size}`);
  canvas.style.setProperty("--weight-node", type.weight);

  const positions = renderNodes(positionsForLayout());
  renderConnectors(positions);
  updateOutputs();

  canvas.setAttribute(
    "aria-label",
    `${theme.label} ${state.layout} composition with ${state.count} elements, ${space.name} and ${space.name.replace("Horizontal", "Vertical")}, ${radius.name}, ${stroke.name}, ${shadow.name}, ${motion.name}, ${accent.name}, and ${state.typography} typography.`,
  );
  if (announce) status.textContent = canvas.getAttribute("aria-label");
}

Object.entries(controls).forEach(([key, control]) => {
  control.addEventListener("input", () => {
    if (["accent", "typography"].includes(key)) state[key] = control.value;
    else state[key] = Number(control.value);
    render();
  });
});

document.querySelectorAll('[name="layout"]').forEach((control) => {
  control.addEventListener("change", () => {
    if (!control.checked) return;
    state.layout = control.value;
    render();
  });
});

const themeButtons = document.querySelectorAll(".theme-switch button[data-theme]");

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    themeButtons.forEach((themeButton) => {
      themeButton.setAttribute("aria-pressed", String(themeButton === button));
    });
    render();
  });
});

document.querySelector("#remix-button").addEventListener("click", () => {
  state.remix += 1;
  render();
});

form.addEventListener("reset", () => {
  window.requestAnimationFrame(() => {
    Object.assign(state, {
      space: 3,
      radius: 3,
      stroke: 0,
      shadow: 2,
      motion: 3,
      accent: "brand",
      typography: "body2",
      theme: "light",
      layout: "orbit",
      count: 6,
      tilt: 4,
      remix: 0,
    });
    themeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.theme === "light"));
    });
    render();
  });
});

render(false);

if ("ResizeObserver" in window) {
  let resizeFrame;
  const canvasResizeObserver = new ResizeObserver(() => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => render(false));
  });
  canvasResizeObserver.observe(canvas);
} else {
  window.addEventListener("resize", () => render(false));
}
