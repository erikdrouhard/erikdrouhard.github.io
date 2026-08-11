const chapterData = {
  dragon: {
    meta: "Dragon Drive · UI/UX Designer",
    title: "Let physical context become part of the interface.",
    summary:
      "The CES technology demonstrator explored how gaze could establish context for a voice command inside a stationary vehicle surrounded by simulated motion.",
    move: "Connect gaze, voice, and motion so the system can show what it understood without demanding another explicit control.",
    thread: "An intelligent interface has to reveal how it interpreted the human—not only show its output.",
    link: "/work/dragon-drive/",
    linkLabel: "Read the Dragon Drive case study",
  },
  mix: {
    meta: "Mix.dialog · Sr. UX Designer",
    title: "Replace a condition table with a language people could manipulate.",
    summary:
      "Conversation designers were authoring deterministic behavior that could branch across any combination of channel and modality. The old table could not make that depth readable.",
    move: "Turn rows and levels into infinitely nestable stacks with direct, local manipulation.",
    thread: "A complex system becomes usable when its structure is visible in the interface.",
    link: "/work/mix-dialog/",
    linkLabel: "Read the Mix.dialog case study",
  },
  verse: {
    meta: "Verse · Sr. UX Engineer",
    title: "Make design decisions executable across teams.",
    summary:
      "Verse connected Figma libraries, accessible React components, shared tokens, composition rules, and implementation guidance across Mix.dialog and the surrounding platform.",
    move: "Treat tokens, components, states, naming, and extension points as one shared model instead of separate design and engineering artifacts.",
    thread: "A system scales when the decision is encoded once and remains legible in every medium.",
    link: "/work/verse-design-system/",
    linkLabel: "Read the Verse case study",
  },
  ai: {
    meta: "Copilot Studio + CoreAI · Product Designer → UX Engineer",
    title: "Prototype the uncertain part until the team can reason about it.",
    summary:
      "Across Copilot Studio, Microsoft Foundry, and Azure portals, focused prototypes turn emerging capability into something teams can inspect, test, evaluate, and reuse.",
    move: "Build the smallest working interface that can answer the next product question, then carry the learning into a reusable skill, mini-app, or workflow.",
    thread: "Prototyping is not decoration. It is how a team makes new behavior concrete enough to evaluate.",
    link: "/work/microsoft/",
    linkLabel: "Read the Microsoft case study",
  },
};

const prototypeCopy = {
  capability: [
    ["Explore · capability", "Find the boundary of what the model can do reliably.", "Start with the uncertain behavior, the user need, and the product context that has to survive contact with a real interface."],
    ["Prototype · capability", "Put the capability inside a focused mini-app.", "A working surface exposes latency, failure states, missing context, and interaction decisions that a prompt alone cannot reveal."],
    ["Evaluate · capability", "Probe the behavior, not only the happy path.", "Compare outputs, inspect failure modes, and decide whether the interaction remains useful when the model is imperfect."],
    ["Reuse · capability", "Package the learning so the next team starts further ahead.", "Turn the validated pattern into a reusable skill, component, or product-context workflow."],
  ],
  interaction: [
    ["Explore · interaction", "Name the moment where the human needs more control.", "Define what the person is trying to predict, correct, approve, or understand before choosing an interface pattern."],
    ["Prototype · interaction", "Make the state change visible and operable.", "Build the real transition, control, and feedback loop instead of presenting a static screen or a written flow."],
    ["Evaluate · interaction", "Watch where intent and system behavior diverge.", "Test whether people can form the right expectation before acting and recover when the system surprises them."],
    ["Reuse · interaction", "Carry the proven behavior into a shared pattern.", "Document the state model and implementation rule so the interaction survives beyond one prototype."],
  ],
  workflow: [
    ["Explore · workflow", "Find the repeated work hiding inside the request.", "Map the stable method, changing inputs, and evidence the team needs before automating anything."],
    ["Prototype · workflow", "Turn the method into a working sequence.", "Connect context, interface, and tool calls in a focused experience the team can use on a real task."],
    ["Evaluate · workflow", "Check the result and the path that produced it.", "Inspect whether the workflow preserves constraints, makes decisions traceable, and fails in a recoverable way."],
    ["Reuse · workflow", "Save the method, not just the output.", "Package the reliable sequence as a reusable skill or internal workflow with the right guardrails and context."],
  ],
};

const storyExplorer = document.querySelector(".story-explorer");
const chapterTabs = [...document.querySelectorAll(".chapter-tab")];
const chapterPanels = [...document.querySelectorAll(".story-panel")];
const chapterMeta = document.querySelector("#chapter-meta");
const chapterTitle = document.querySelector("#chapter-title");
const chapterSummary = document.querySelector("#chapter-summary");
const chapterMove = document.querySelector("#chapter-move");
const chapterThread = document.querySelector("#chapter-thread");
const chapterLink = document.querySelector("#chapter-link");

function selectChapter(chapter, moveFocus = false) {
  const nextData = chapterData[chapter];
  const nextTab = chapterTabs.find((tab) => tab.dataset.chapter === chapter);
  const nextPanel = document.querySelector(`#panel-${chapter}`);
  if (!nextData || !nextTab || !nextPanel) return;

  storyExplorer.dataset.active = chapter;
  chapterTabs.forEach((tab) => {
    const isSelected = tab === nextTab;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });
  chapterPanels.forEach((panel) => {
    panel.hidden = panel !== nextPanel;
  });

  chapterMeta.textContent = nextData.meta;
  chapterTitle.textContent = nextData.title;
  chapterSummary.textContent = nextData.summary;
  chapterMove.textContent = nextData.move;
  chapterThread.textContent = nextData.thread;
  chapterLink.href = nextData.link;
  chapterLink.firstChild.textContent = `${nextData.linkLabel} `;

  const chapterIndex = chapterTabs.indexOf(nextTab);
  storyExplorer.style.setProperty("--chapter-index", chapterIndex);
  history.replaceState(null, "", `#chapter-${chapter}`);

  nextPanel.classList.remove("is-entering");
  requestAnimationFrame(() => nextPanel.classList.add("is-entering"));
  if (moveFocus) nextTab.focus();
}

chapterTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectChapter(tab.dataset.chapter));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + chapterTabs.length) % chapterTabs.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % chapterTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = chapterTabs.length - 1;
    selectChapter(chapterTabs[nextIndex].dataset.chapter, true);
  });
});

const hashChapter = window.location.hash.match(/^#chapter-(dragon|mix|verse|ai)$/)?.[1];
selectChapter(hashChapter || "mix");

const gazeDemo = document.querySelector(".gaze-demo");
const gazeResponse = document.querySelector("#gaze-response");
const gazeCopy = {
  weather: "Open the detailed weather view.",
  route: "Expand the next route instruction.",
  music: "Show more information about this track.",
};

document.querySelectorAll(".gaze-target").forEach((button) => {
  button.addEventListener("click", () => {
    const context = button.dataset.context;
    gazeDemo.dataset.gazeContext = context;
    gazeResponse.textContent = gazeCopy[context];
    document.querySelectorAll(".gaze-target").forEach((target) => {
      target.setAttribute("aria-pressed", String(target === button));
    });
  });
});

const verseDemo = document.querySelector(".verse-demo");
const spaceInput = document.querySelector("#space-token");
const radiusInput = document.querySelector("#radius-token");
const spaceOutput = document.querySelector("#space-output");
const radiusOutput = document.querySelector("#radius-output");
const codeSpace = document.querySelector("#code-space");
const codeRadius = document.querySelector("#code-radius");
const codeSurface = document.querySelector("#code-surface");

function updateTokens() {
  const space = `${spaceInput.value}px`;
  const radius = `${radiusInput.value}px`;
  verseDemo.style.setProperty("--demo-space", space);
  verseDemo.style.setProperty("--demo-radius", radius);
  spaceOutput.value = spaceInput.value;
  radiusOutput.value = radiusInput.value;
  codeSpace.textContent = space;
  codeRadius.textContent = radius;
}

spaceInput.addEventListener("input", updateTokens);
radiusInput.addEventListener("input", updateTokens);
updateTokens();

document.querySelectorAll(".tone-button").forEach((button) => {
  button.addEventListener("click", () => {
    const tone = button.dataset.tone;
    verseDemo.dataset.verseTone = tone;
    codeSurface.textContent = tone === "dark" ? "#15181e" : "#ffffff";
    document.querySelectorAll(".tone-button").forEach((toneButton) => {
      toneButton.setAttribute("aria-pressed", String(toneButton === button));
    });
  });
});

const prototypeLab = document.querySelector(".prototype-lab");
const prototypeKicker = document.querySelector("#prototype-kicker");
const prototypeTitle = document.querySelector("#prototype-title");
const prototypeBody = document.querySelector("#prototype-body");
const prototypeNext = document.querySelector("#prototype-next");

function updatePrototype(goal, step) {
  const safeStep = Number(step) % 4;
  const [kicker, title, body] = prototypeCopy[goal][safeStep];
  prototypeLab.dataset.prototypeGoal = goal;
  prototypeLab.dataset.prototypeStep = safeStep;
  prototypeKicker.textContent = kicker;
  prototypeTitle.textContent = title;
  prototypeBody.textContent = body;

  document.querySelectorAll(".prototype-goal").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.goal === goal));
  });
  document.querySelectorAll(".prototype-steps li").forEach((item, index) => {
    item.classList.toggle("is-current", index === safeStep);
    item.classList.toggle("is-complete", index < safeStep);
  });
  prototypeNext.firstChild.textContent = safeStep === 3 ? "Start again " : "Next pass ";
}

document.querySelectorAll(".prototype-goal").forEach((button) => {
  button.addEventListener("click", () => updatePrototype(button.dataset.goal, 0));
});

document.querySelectorAll(".prototype-steps button").forEach((button) => {
  button.addEventListener("click", () => updatePrototype(prototypeLab.dataset.prototypeGoal, Number(button.dataset.step)));
});

prototypeNext.addEventListener("click", () => {
  const nextStep = (Number(prototypeLab.dataset.prototypeStep) + 1) % 4;
  updatePrototype(prototypeLab.dataset.prototypeGoal, nextStep);
});

updatePrototype("capability", 0);
