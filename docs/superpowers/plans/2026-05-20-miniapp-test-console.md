# MiniApp Test Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page TeamGaga MiniApp test console that covers the approved P0 + P1 + P2 scope for API validation, event inspection, CSS variable verification, and safe-area experiments.

**Architecture:** Keep the console as a standalone browser page rooted at `test.html`, with small ESM modules under `test/test-console/` for config, state normalization, DOM rendering, and runtime wiring. Test the pure config/state modules with `vite-plus` unit tests, and keep the browser-only layer thin so it is easy to inspect inside the TeamGaga app.

**Tech Stack:** TypeScript tests via `vite-plus/test`, plain browser ESM JavaScript, standalone HTML/CSS, existing SDK bundles from `dist/`

---

## File Structure

### New files

- `test.html`
  - Standalone entry page for the real-device console.
- `test/test-console/styles.css`
  - Page layout, cards, logs, CSS variable previews, and safe-area experiment styles.
- `test/test-console/api-config.js`
  - Declarative API group metadata, default params, presets, and capability labels.
- `test/test-console/state.js`
  - Pure helpers for environment snapshots, call records, log entries, CSS variable collection, and diff summaries.
- `test/test-console/dom.js`
  - DOM rendering helpers that take normalized state and update the page sections.
- `test/test-console/index.js`
  - Browser bootstrap, event registration, runtime detection, API execution, and UI wiring.
- `test/assets/download-fixture.txt`
  - Small local static file used by the download test preset.

### New tests

- `test/test-console.state.test.ts`
  - Validates state normalization, diff summaries, log formatting, and CSS variable collection helpers.
- `test/test-console.api-config.test.ts`
  - Validates first-version API coverage, group assignments, and key presets/defaults.

### Existing files to modify

- `README.md`
  - Add a short “test console” section with local preview instructions and file purpose.

## Task 1: Build the test-console state model first

**Files:**

- Create: `test/test-console/state.js`
- Test: `test/test-console.state.test.ts`

- [ ] **Step 1: Write the failing state-helper tests**

```ts
import { describe, expect, test } from "vite-plus/test";

import {
  buildCallRecord,
  buildEnvironmentSnapshot,
  buildEnvironmentDiff,
  collectCssVariables,
  createLogEntry,
} from "../test/test-console/state.js";

describe("buildEnvironmentSnapshot", () => {
  test("captures init data and runtime getters into a comparable shape", () => {
    const snapshot = buildEnvironmentSnapshot({
      initData: {
        appVersion: "3.4.0",
        sdkVersion: "0.2.0",
        colorScheme: "dark",
        platform: "ios",
      },
      runtime: {
        appVersion: "3.4.0",
        sdkVersion: "0.2.0",
        colorScheme: "dark",
        platform: "ios",
      },
    });

    expect(snapshot.initData?.appVersion).toBe("3.4.0");
    expect(snapshot.runtime?.platform).toBe("ios");
  });
});

describe("buildEnvironmentDiff", () => {
  test("marks fields whose init and runtime values differ", () => {
    expect(
      buildEnvironmentDiff({
        initData: { appVersion: "3.4.0" },
        runtime: { appVersion: "3.5.0" },
      }),
    ).toEqual([
      {
        field: "appVersion",
        initValue: "3.4.0",
        runtimeValue: "3.5.0",
      },
    ]);
  });
});

describe("buildCallRecord", () => {
  test("computes duration and preserves error payloads", () => {
    expect(
      buildCallRecord({
        name: "ready",
        startedAt: 100,
        finishedAt: 140,
        status: "error",
        error: { code: "FAIL", message: "boom" },
      }),
    ).toMatchObject({
      name: "ready",
      durationMs: 40,
      status: "error",
    });
  });
});

describe("createLogEntry", () => {
  test("adds a timestamp and log level", () => {
    expect(
      createLogEntry({
        source: "api",
        level: "info",
        message: "init ok",
      }),
    ).toMatchObject({
      source: "api",
      level: "info",
      message: "init ok",
    });
  });
});

describe("collectCssVariables", () => {
  test("reads known tgg variables from computed style", () => {
    const variables = collectCssVariables({
      getPropertyValue(name) {
        if (name === "--tgg-color-scheme") return "dark";
        if (name === "--tgg-viewport-height") return "812px";
        return "";
      },
    });

    expect(variables["--tgg-color-scheme"]).toBe("dark");
    expect(variables["--tgg-viewport-height"]).toBe("812px");
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `pnpm test -- --run test/test-console.state.test.ts`

Expected: FAIL with module-resolution errors for `test/test-console/state.js` exports.

- [ ] **Step 3: Implement the minimal pure helpers in `state.js`**

```js
const ENVIRONMENT_FIELDS = [
  "appVersion",
  "sdkVersion",
  "colorScheme",
  "platform",
  "viewportHeight",
  "viewportStableHeight",
  "headerColor",
  "backgroundColor",
  "isFullscreen",
  "safeAreaInset",
  "contentSafeAreaInset",
  "launchContext",
];

export const buildEnvironmentSnapshot = ({
  initData,
  runtime,
  transport,
  injected,
  initError,
}) => ({
  injected,
  transport,
  initError: initError ?? null,
  initData: initData ?? null,
  runtime: runtime ?? null,
});

export const buildEnvironmentDiff = ({ initData, runtime }) =>
  ENVIRONMENT_FIELDS.flatMap((field) => {
    const initValue = initData?.[field] ?? null;
    const runtimeValue = runtime?.[field] ?? null;
    return JSON.stringify(initValue) === JSON.stringify(runtimeValue)
      ? []
      : [{ field, initValue, runtimeValue }];
  });

export const buildCallRecord = ({
  name,
  params,
  startedAt,
  finishedAt,
  status,
  result,
  error,
}) => ({
  name,
  params: params ?? null,
  startedAt,
  finishedAt,
  durationMs: typeof finishedAt === "number" ? Math.max(0, finishedAt - startedAt) : null,
  status,
  result: result ?? null,
  error: error ?? null,
});

export const createLogEntry = ({ source, level, message, detail }) => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  source,
  level,
  message,
  detail: detail ?? null,
});

const CSS_VARIABLE_NAMES = [
  "--tgg-color-scheme",
  "--tgg-viewport-height",
  "--tgg-viewport-stable-height",
  "--tgg-header-color",
  "--tgg-background-color",
  "--tgg-is-fullscreen",
  "--tgg-safe-area-inset-top",
  "--tgg-safe-area-inset-right",
  "--tgg-safe-area-inset-bottom",
  "--tgg-safe-area-inset-left",
  "--tgg-content-safe-area-inset-top",
  "--tgg-content-safe-area-inset-right",
  "--tgg-content-safe-area-inset-bottom",
  "--tgg-content-safe-area-inset-left",
];

export const collectCssVariables = (style) =>
  Object.fromEntries(CSS_VARIABLE_NAMES.map((name) => [name, style.getPropertyValue(name).trim()]));
```

- [ ] **Step 4: Run the state-helper tests again**

Run: `pnpm test -- --run test/test-console.state.test.ts`

Expected: PASS for all `state.js` helper tests.

- [ ] **Step 5: Commit the state-model slice**

```bash
git add test/test-console/state.js test/test-console.state.test.ts
git commit -m "test: add miniapp console state helpers"
```

## Task 2: Lock the first-version API coverage in config

**Files:**

- Create: `test/test-console/api-config.js`
- Create: `test/assets/download-fixture.txt`
- Test: `test/test-console.api-config.test.ts`

- [ ] **Step 1: Write the failing API-config coverage tests**

```ts
import { expect, test } from "vite-plus/test";

import { API_GROUPS, API_ITEMS, VERSION_PRESETS } from "../test/test-console/api-config.js";

test("covers all approved P0 P1 P2 api items", () => {
  expect(API_GROUPS.map((group) => group.id)).toEqual([
    "lifecycle-ui",
    "business-system",
    "device",
  ]);

  expect(API_ITEMS.map((item) => item.id)).toEqual(
    expect.arrayContaining([
      "init",
      "ready",
      "close",
      "setHeaderColor",
      "backButtonShow",
      "backButtonHide",
      "backButtonBind",
      "backButtonUnbind",
      "getOauthCode",
      "getUserId",
      "getUserInfo",
      "getSystemInfo",
      "getCommunityId",
      "getCommunityInfo",
      "downloadFile",
      "savePhoto",
      "saveVideo",
      "clipboardTextReceived",
    ]),
  );
});

test("provides first-class presets for header color and version checks", () => {
  const headerColor = API_ITEMS.find((item) => item.id === "setHeaderColor");
  expect(headerColor?.presets).toEqual(["bg_color", "secondary_bg_color", "#18A0FB"]);
  expect(VERSION_PRESETS).toEqual(["1.0.0", "2.0.0", "3.2.0"]);
});

test("points download presets at the bundled local fixture", () => {
  const downloadItem = API_ITEMS.find((item) => item.id === "downloadFile");
  expect(downloadItem?.defaultParams).toMatchObject({
    url: "./test/assets/download-fixture.txt",
  });
});
```

- [ ] **Step 2: Run the config tests and confirm they fail**

Run: `pnpm test -- --run test/test-console.api-config.test.ts`

Expected: FAIL because `test/test-console/api-config.js` does not exist yet.

- [ ] **Step 3: Implement the API metadata and bundled fixture**

```js
export const API_GROUPS = [
  { id: "lifecycle-ui", title: "Lifecycle & UI API" },
  { id: "business-system", title: "Business & System API" },
  { id: "device", title: "Device API" },
];

export const VERSION_PRESETS = ["1.0.0", "2.0.0", "3.2.0"];

export const HEADER_COLOR_PRESETS = ["bg_color", "secondary_bg_color", "#18A0FB"];

export const API_ITEMS = [
  { id: "init", group: "lifecycle-ui", title: "init", kind: "method" },
  { id: "ready", group: "lifecycle-ui", title: "ready", kind: "method" },
  { id: "close", group: "lifecycle-ui", title: "close", kind: "method" },
  {
    id: "setHeaderColor",
    group: "lifecycle-ui",
    title: "setHeaderColor",
    kind: "method",
    presets: HEADER_COLOR_PRESETS,
    defaultParams: { color: "bg_color" },
  },
  { id: "backButtonShow", group: "lifecycle-ui", title: "BackButton.show", kind: "method" },
  { id: "backButtonHide", group: "lifecycle-ui", title: "BackButton.hide", kind: "method" },
  { id: "backButtonBind", group: "lifecycle-ui", title: "BackButton.onClick", kind: "event-bind" },
  {
    id: "backButtonUnbind",
    group: "lifecycle-ui",
    title: "BackButton.offClick",
    kind: "event-bind",
  },
  { id: "getOauthCode", group: "business-system", title: "getOauthCode", kind: "method" },
  { id: "getUserId", group: "business-system", title: "getUserId", kind: "method" },
  { id: "getUserInfo", group: "business-system", title: "getUserInfo", kind: "method" },
  { id: "getSystemInfo", group: "business-system", title: "getSystemInfo", kind: "method" },
  { id: "getCommunityId", group: "business-system", title: "getCommunityId", kind: "method" },
  { id: "getCommunityInfo", group: "business-system", title: "getCommunityInfo", kind: "method" },
  {
    id: "downloadFile",
    group: "device",
    title: "downloadFile",
    kind: "task",
    defaultParams: {
      url: "./test/assets/download-fixture.txt",
    },
  },
  {
    id: "savePhoto",
    group: "device",
    title: "savePhoto",
    kind: "method",
    defaultParams: {
      url: "https://cdn-test.teamgaga.com/attachments/f1p3uesp340-fb14c7dc-a7df-4442-a156-f489fcf59486.jpg",
    },
  },
  {
    id: "saveVideo",
    group: "device",
    title: "saveVideo",
    kind: "method",
    defaultParams: {
      url: "https://cdn-test.teamgaga.com/attachments/demo-video.mp4",
    },
  },
  { id: "clipboardTextReceived", group: "device", title: "clipboardTextReceived", kind: "event" },
];
```

```txt
TeamGaga MiniApp download fixture
```

- [ ] **Step 4: Run the config tests again**

Run: `pnpm test -- --run test/test-console.api-config.test.ts`

Expected: PASS with all first-version API items and presets covered.

- [ ] **Step 5: Commit the config slice**

```bash
git add test/test-console/api-config.js test/assets/download-fixture.txt test/test-console.api-config.test.ts
git commit -m "test: define miniapp console api metadata"
```

## Task 3: Build the standalone page shell and renderers

**Files:**

- Create: `test.html`
- Create: `test/test-console/styles.css`
- Create: `test/test-console/dom.js`

- [ ] **Step 1: Add the page shell with named mount points**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>TeamGaga MiniApp Test Console</title>
    <link rel="stylesheet" href="./test/test-console/styles.css" />
  </head>
  <body>
    <main class="page-shell">
      <header class="hero">
        <p class="eyebrow">TeamGaga MiniApp JS SDK</p>
        <h1>Real-device test console</h1>
        <p class="hero-copy">
          P0 + P1 + P2 coverage for API calls, events, CSS vars, and safe area.
        </p>
      </header>

      <section id="environment-overview" class="panel"></section>
      <section id="lifecycle-ui-api" class="panel"></section>
      <section id="business-system-api" class="panel"></section>
      <section id="device-api" class="panel"></section>
      <section id="event-log" class="panel"></section>
      <section id="css-vars" class="panel"></section>
      <section id="safe-area-lab" class="panel"></section>
    </main>

    <script type="module" src="./test/test-console/index.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Add the visual system and safe-area-friendly layout styles**

```css
:root {
  --page-max-width: 1180px;
  --panel-radius: 24px;
  --panel-border: rgba(15, 23, 42, 0.08);
  --page-bg: linear-gradient(180deg, #f6f9fc 0%, #eef3f8 100%);
  --text-main: #102033;
  --text-muted: #5e6b7a;
  --accent: #0f9d7a;
  --danger: #d14343;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "SF Pro Display", "Helvetica Neue", sans-serif;
  color: var(--text-main);
  background: var(--page-bg);
}

.page-shell {
  width: min(100%, var(--page-max-width));
  margin: 0 auto;
  padding: calc(24px + var(--tgg-safe-area-inset-top, 0px)) 16px
    calc(32px + var(--tgg-content-safe-area-inset-bottom, 0px));
}

.panel {
  margin-top: 16px;
  padding: 20px;
  border: 1px solid var(--panel-border);
  border-radius: var(--panel-radius);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
}
```

- [ ] **Step 3: Implement the section render helpers in `dom.js`**

```js
const json = (value) => `<pre>${escapeHtml(JSON.stringify(value, null, 2) ?? "")}</pre>`;

export const renderEnvironmentOverview = (
  container,
  snapshot,
  diff,
  capabilities,
  versionChecks,
) => {
  container.innerHTML = `
    <div class="panel-head">
      <h2>Environment Overview</h2>
      <span class="status-pill ${snapshot.injected ? "ok" : "warn"}">
        ${snapshot.injected ? "Injected" : "Not injected"}
      </span>
    </div>
    <div class="grid two-up">
      <article>${json(snapshot.initData)}</article>
      <article>${json(snapshot.runtime)}</article>
    </div>
    <article>${json(diff)}</article>
    <article>${json({ capabilities, versionChecks })}</article>
  `;
};

export const renderApiGroup = (container, group, items, callRecords) => {
  container.innerHTML = `
    <div class="panel-head"><h2>${group.title}</h2></div>
    <div class="api-grid">
      ${items
        .map((item) => {
          const record = callRecords[item.id];
          return `
            <article class="api-card" data-api-id="${item.id}">
              <h3>${item.title}</h3>
              <div class="api-controls" data-role="controls"></div>
              <div class="api-result">${json(record ?? { status: "idle" })}</div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
};

export const renderLogPanel = (container, logs) => {
  container.innerHTML = `
    <div class="panel-head"><h2>Events & Logs</h2></div>
    <div class="log-list">
      ${logs.map((entry) => `<article class="log-row">${json(entry)}</article>`).join("")}
    </div>
  `;
};
```

- [ ] **Step 4: Preview the shell visually**

Run: `python3 -m http.server 4173`

Then open `http://127.0.0.1:4173/test.html`

Expected: a styled single-page shell with seven empty panel mount points and no console syntax errors.

- [ ] **Step 5: Commit the page-shell slice**

```bash
git add test.html test/test-console/styles.css test/test-console/dom.js
git commit -m "feat: add miniapp test console shell"
```

## Task 4: Wire runtime detection, API execution, logs, CSS vars, and safe-area lab

**Files:**

- Create: `test/test-console/index.js`
- Modify: `test/test-console/dom.js`
- Modify: `README.md`

- [ ] **Step 1: Bootstrap the console and register runtime listeners**

```js
import { API_GROUPS, API_ITEMS, VERSION_PRESETS } from "./api-config.js";
import {
  buildCallRecord,
  buildEnvironmentDiff,
  buildEnvironmentSnapshot,
  collectCssVariables,
  createLogEntry,
} from "./state.js";
import {
  renderApiGroup,
  renderEnvironmentOverview,
  renderLogPanel,
  renderCssVariablePanel,
  renderSafeAreaLab,
} from "./dom.js";

const state = {
  snapshot: buildEnvironmentSnapshot({
    injected: Boolean(window.tgg),
    transport: detectTransport(),
  }),
  callRecords: {},
  logs: [],
  cssVariables: {},
  backButtonClicks: 0,
  boundBackButtonHandler: null,
  clipboard: null,
  downloadTask: null,
};

const EVENT_NAMES = [
  "themeChanged",
  "viewportChanged",
  "safeAreaChanged",
  "contentSafeAreaChanged",
  "fullscreenChanged",
  "backButtonClicked",
  "downloadFileProgress",
  "downloadFileSuccess",
  "downloadFileFail",
  "clipboardTextReceived",
];
```

- [ ] **Step 2: Implement `init`, environment refresh, and unified API execution**

```js
const executeApi = async (item, params) => {
  const startedAt = Date.now();
  try {
    const result = await invokeItem(item, params);
    state.callRecords[item.id] = buildCallRecord({
      name: item.title,
      params,
      startedAt,
      finishedAt: Date.now(),
      status: "success",
      result,
    });
    pushLog("api", "info", `${item.title} succeeded`, result);
  } catch (error) {
    state.callRecords[item.id] = buildCallRecord({
      name: item.title,
      params,
      startedAt,
      finishedAt: Date.now(),
      status: "error",
      error: serializeError(error),
    });
    pushLog("api", "error", `${item.title} failed`, serializeError(error));
  }
  refreshAll();
};

const refreshEnvironment = async () => {
  if (!window.tgg) {
    state.snapshot = buildEnvironmentSnapshot({
      injected: false,
      transport: detectTransport(),
      initError: { message: "window.tgg is not injected" },
    });
    return;
  }

  try {
    const initData = await window.tgg.init();
    state.snapshot = buildEnvironmentSnapshot({
      injected: true,
      transport: detectTransport(),
      initData,
      runtime: pickRuntimeFields(window.tgg),
    });
  } catch (error) {
    state.snapshot = buildEnvironmentSnapshot({
      injected: true,
      transport: detectTransport(),
      initError: serializeError(error),
      runtime: pickRuntimeFields(window.tgg),
    });
  }
};
```

- [ ] **Step 3: Render the API controls, CSS variable panel, and safe-area lab**

```js
export const renderCssVariablePanel = (container, cssVariables) => {
  container.innerHTML = `
    <div class="panel-head"><h2>CSS Variables</h2></div>
    <div class="css-var-grid">
      ${Object.entries(cssVariables)
        .map(
          ([name, value]) => `
            <article class="css-var-card">
              <strong>${name}</strong>
              <span>${value || "(empty)"}</span>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

export const renderSafeAreaLab = (container, mode) => {
  container.innerHTML = `
    <div class="panel-head"><h2>Safe Area Lab</h2></div>
    <div class="safe-area-demo" data-height-mode="${mode.height}" data-bottom-mode="${mode.bottom}">
      <div class="safe-area-demo__header">Sticky Header</div>
      <div class="safe-area-demo__body">Scrollable content preview</div>
      <div class="safe-area-demo__footer">Fixed Action Bar</div>
    </div>
  `;
};
```

- [ ] **Step 4: Document local usage and run full verification**

Add this README section:

````md
## Test Console

For real-device TeamGaga validation, open `test.html` from a static file server after building the SDK bundles:

```sh
pnpm run build
python3 -m http.server 4173
```
````

Then open `http://127.0.0.1:4173/test.html`.

````

Run:

```sh
pnpm test -- --run test/test-console.state.test.ts test/test-console.api-config.test.ts
pnpm run build
````

Expected:

- both new test files PASS
- build completes and continues to emit the existing `dist/` bundles
- `test.html` loads from a static server and shows all seven sections

- [ ] **Step 5: Commit the wired console**

```bash
git add test/test-console/index.js test/test-console/dom.js README.md
git add test.html test/test-console/styles.css test/test-console/api-config.js
git add test/test-console/state.js test/assets/download-fixture.txt
git add test/test-console.state.test.ts test/test-console.api-config.test.ts
git commit -m "feat: add miniapp real-device test console"
```

## Self-Review

- Spec coverage:
  - Single-page console structure is covered in Tasks 3 and 4.
  - P0 / P1 / P2 API coverage is locked in Task 2 and executed in Task 4.
  - Logs, events, CSS vars, and safe-area lab are wired in Task 4.
  - Browser downgrade behavior is handled in Task 4 via `window.tgg` detection and non-crashing rendering.
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” placeholders remain in tasks.
- Type consistency:
  - API item ids and helper names are consistent across Tasks 1, 2, and 4.
