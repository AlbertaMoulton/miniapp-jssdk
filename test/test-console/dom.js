const clearNode = (node) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const appendChildren = (node, children) => {
  clearNode(node);

  for (const child of children) {
    if (child) {
      node.appendChild(child);
    }
  }

  return node;
};

const setText = (node, textContent) => {
  if (node) {
    node.textContent = textContent;
  }

  return node;
};

const createElement = (tagName, className, textContent) => {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent != null) {
    element.textContent = textContent;
  }

  return element;
};

const readProperty = (value, key) => {
  try {
    return value?.[key];
  } catch (error) {
    return `[Thrown while reading ${String(key)}: ${error instanceof Error ? error.message : String(error)}]`;
  }
};

const listOwnKeys = (value) => {
  try {
    return Reflect.ownKeys(value);
  } catch (error) {
    return [`[Own keys unavailable: ${error instanceof Error ? error.message : String(error)}]`];
  }
};

const readDescriptor = (value, key) => {
  try {
    return Object.getOwnPropertyDescriptor(value, key) ?? null;
  } catch (error) {
    return {
      error: `[Descriptor unavailable for ${String(key)}: ${error instanceof Error ? error.message : String(error)}]`,
    };
  }
};

const describeValue = (value) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return String(value);
  } catch (error) {
    return `[Unserializable: ${error instanceof Error ? error.message : String(error)}]`;
  }
};

const sanitizeForSerialization = (value, seen = new WeakSet(), depth = 0) => {
  if (value == null) {
    return value;
  }

  if (depth > 8) {
    return "[Max depth exceeded]";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  if (typeof value !== "object") {
    return describeValue(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const keys = listOwnKeys(value)
      .filter((key) => typeof key === "string" && /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right));

    return keys.map((key) => sanitizeForSerialization(readProperty(value, key), seen, depth + 1));
  }

  const output = {};

  for (const key of listOwnKeys(value)) {
    const descriptor = readDescriptor(value, key);
    const normalizedKey = typeof key === "symbol" ? key.toString() : String(key);

    if (descriptor?.error) {
      output[normalizedKey] = descriptor.error;
      continue;
    }

    if (!descriptor) {
      output[normalizedKey] = "[Property unavailable]";
      continue;
    }

    if ("value" in descriptor) {
      output[normalizedKey] = sanitizeForSerialization(descriptor.value, seen, depth + 1);
      continue;
    }

    if (typeof descriptor.get === "function") {
      output[normalizedKey] = sanitizeForSerialization(readProperty(value, key), seen, depth + 1);
      continue;
    }

    output[normalizedKey] = "[Accessor without getter]";
  }

  return output;
};

const safeSerialize = (value) => {
  if (value == null) {
    return "";
  }

  try {
    const sanitized = sanitizeForSerialization(value);
    const serialized = JSON.stringify(sanitized, null, 2);

    return serialized ?? describeValue(value);
  } catch (error) {
    return `[Serialization failed: ${error instanceof Error ? error.message : String(error)}]\n${describeValue(value)}`;
  }
};

const createJsonBlock = (value, liveMode) => {
  const wrapper = createElement("div", "json-block");
  const pre = document.createElement("pre");

  pre.textContent = safeSerialize(value);
  wrapper.appendChild(pre);

  if (liveMode) {
    wrapper.setAttribute("aria-live", liveMode);
    wrapper.setAttribute("aria-atomic", "true");
  }

  return wrapper;
};

const createEmptyState = (message) => createElement("div", "empty-state", message);

const createButton = (label, options = {}) => {
  const button = createElement("button", options.className, label);

  button.type = "button";

  if (options.disabled) {
    button.disabled = true;
  }

  if (options.title) {
    button.title = options.title;
  }

  if (typeof options.onClick === "function") {
    button.addEventListener("click", options.onClick);
  }

  return button;
};

const createTextControl = (itemId, key, value, onChange) => {
  const input = document.createElement(value && String(value).length > 80 ? "textarea" : "input");

  input.name = `${itemId}:${key}`;
  input.dataset.apiId = itemId;
  input.dataset.paramKey = key;
  input.value = toText(value);

  if (input instanceof HTMLInputElement) {
    input.type = "text";
  } else {
    input.rows = 3;
  }

  if (typeof onChange === "function") {
    input.addEventListener("input", (event) => {
      onChange(itemId, key, event.currentTarget?.value ?? "");
    });
  }

  return input;
};

const createField = (label, control) => {
  const wrapper = createElement("label");
  const heading = createElement("strong", null, label);

  wrapper.append(heading, control);

  return wrapper;
};

const createStatusPill = (isPositive, positiveLabel, negativeLabel) => {
  const pill = createElement(
    "span",
    `status-pill ${isPositive ? "ok" : "warn"}`,
    isPositive ? positiveLabel : negativeLabel,
  );

  return pill;
};

const createPanelHead = (title, trailingNode) => {
  const head = createElement("div", "panel-head");
  const heading = createElement("h2", null, title);

  head.appendChild(heading);

  if (trailingNode) {
    head.appendChild(trailingNode);
  }

  return head;
};

const ensurePanelFrame = (container, panelTitle) => {
  let head = container.querySelector(".panel-head");
  let title = head?.querySelector("h2");
  let status = head?.querySelector('[data-role="panel-status"]');
  let body = container.querySelector('[data-role="panel-body"]');

  if (!head) {
    head = createPanelHead(panelTitle);
    container.appendChild(head);
  }

  if (!title) {
    title = createElement("h2");
    head.prepend(title);
  }

  title.textContent = panelTitle;

  if (!status) {
    status = createElement("div");
    status.dataset.role = "panel-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    head.appendChild(status);
  }

  if (!body) {
    body = createElement("div");
    body.dataset.role = "panel-body";
    container.appendChild(body);
  }

  return { head, title, status, body };
};

const createDataCard = (title, contentNode) => {
  const card = createElement("article", "data-card");
  const heading = createElement("h3", null, title);

  card.appendChild(heading);

  if (contentNode) {
    card.appendChild(contentNode);
  }

  return card;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const toText = (value, fallback = "") => (value == null ? fallback : String(value));

const ensureRegion = (container, selector, createNode) => {
  const existingNode = container.querySelector(selector);

  if (existingNode) {
    return existingNode;
  }

  const nextNode = createNode();
  container.appendChild(nextNode);
  return nextNode;
};

const ensureDataCard = (container, role, title) => {
  const selector = `[data-role="${role}"]`;
  const card = ensureRegion(container, selector, () => {
    const nextCard = createElement("article", "data-card");
    nextCard.dataset.role = role;
    nextCard.appendChild(createElement("h3"));
    nextCard.appendChild(createElement("div", "data-card__content"));
    return nextCard;
  });
  const heading = card.querySelector("h3");
  const content = card.querySelector(".data-card__content");

  setText(heading, title);

  return { card, content };
};

const replaceRegionContent = (container, nextChildren) => {
  appendChildren(container, nextChildren);
  return container;
};

const reconcileChildOrder = (container, orderedChildren) => {
  const nextChildren = orderedChildren.filter(Boolean);
  const nextSet = new Set(nextChildren);

  for (const existingChild of Array.from(container.children)) {
    if (!nextSet.has(existingChild)) {
      existingChild.remove();
    }
  }

  for (let index = 0; index < nextChildren.length; index += 1) {
    const child = nextChildren[index];
    const currentChild = container.children[index];

    if (currentChild !== child) {
      container.insertBefore(child, currentChild ?? null);
    }
  }

  return container;
};

const setHidden = (node, isHidden) => {
  if (!node) {
    return;
  }

  node.hidden = isHidden;
  node.setAttribute("aria-hidden", String(isHidden));
};

const buildApiMeta = (item) => {
  const parts = [toText(item?.kind, "method")];

  if (Array.isArray(item?.presets) && item.presets.length) {
    parts.push(`${item.presets.length} presets`);
  }

  return parts.join(" • ");
};

export const renderEnvironmentOverview = (
  container,
  snapshot = {},
  diff = [],
  capabilities = {},
  versionChecks = {},
) => {
  if (!(container instanceof Element)) {
    return;
  }

  const safeSnapshot = normalizeObject(snapshot);
  const safeDiff = normalizeArray(diff);
  const panel = ensurePanelFrame(container, "Environment Overview");
  const summaryGrid = ensureRegion(panel.body, ".grid.two-up", () =>
    createElement("div", "grid two-up"),
  );
  const initCard = ensureDataCard(summaryGrid, "init-data", "Init Data");
  const runtimeCard = ensureDataCard(summaryGrid, "runtime-snapshot", "Runtime Snapshot");
  const diffCard = ensureDataCard(panel.body, "diff-summary", "Diff Summary");
  const checksCard = ensureDataCard(
    panel.body,
    "capabilities-version-checks",
    "Capabilities & Version Checks",
  );

  panel.status.replaceChildren(
    createStatusPill(Boolean(safeSnapshot.injected), "Injected", "Not injected"),
  );

  replaceRegionContent(initCard.content, [
    createJsonBlock(safeSnapshot.initData ?? null, "polite"),
  ]);
  replaceRegionContent(runtimeCard.content, [
    createJsonBlock(safeSnapshot.runtime ?? null, "polite"),
  ]);
  replaceRegionContent(diffCard.content, [
    safeDiff.length
      ? createJsonBlock(safeDiff, "polite")
      : createEmptyState("No init/runtime drift detected."),
  ]);
  replaceRegionContent(checksCard.content, [
    createJsonBlock(
      {
        capabilities: normalizeObject(capabilities),
        versionChecks: normalizeObject(versionChecks),
      },
      "polite",
    ),
  ]);
};

const createApiCard = (itemId) => {
  const card = createElement("article", "api-card");
  const identity = createElement("div");
  const heading = createElement("h3");
  const meta = createElement("p", "api-meta");
  const controls = createElement("div", "api-controls");
  const result = createElement("div", "api-result");

  card.dataset.apiId = itemId;
  identity.appendChild(heading);
  identity.appendChild(meta);
  controls.dataset.role = "controls";
  result.dataset.role = "result";
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");

  card.appendChild(identity);
  card.appendChild(controls);
  card.appendChild(result);

  return card;
};

const updateApiCard = (card, item, record, options = {}) => {
  const heading = card.querySelector("h3");
  const meta = card.querySelector(".api-meta");
  const controls = card.querySelector('[data-role="controls"]');
  const result = card.querySelector('[data-role="result"]');
  const safeOptions = normalizeObject(options);
  const formValues = normalizeObject(safeOptions.formValues);
  const runtimeState = normalizeObject(safeOptions.runtimeState);
  const itemId = toText(item?.id);

  if (heading) {
    heading.textContent = toText(item?.title, "Untitled API");
  }

  if (meta) {
    meta.textContent = buildApiMeta(item);
  }

  if (controls) {
    const nextControls = [];
    const paramEntries = Object.entries(formValues);

    for (const [key, value] of paramEntries) {
      nextControls.push(
        createField(key, createTextControl(itemId, key, value, safeOptions.onFormChange)),
      );
    }

    if (Array.isArray(item?.presets) && item.presets.length) {
      const select = document.createElement("select");

      select.dataset.apiId = itemId;

      for (const preset of item.presets) {
        const option = document.createElement("option");

        option.value = toText(preset);
        option.textContent = toText(preset);
        option.selected = formValues.color === preset;
        select.appendChild(option);
      }

      if (typeof safeOptions.onPresetChange === "function") {
        select.addEventListener("change", (event) => {
          safeOptions.onPresetChange(itemId, event.currentTarget?.value ?? "");
        });
      }

      nextControls.push(createField("preset", select));
    }

    if (runtimeState.boundLabel) {
      nextControls.push(createElement("span", "ghost-chip", runtimeState.boundLabel));
    }

    if (runtimeState.extraLabel) {
      nextControls.push(createElement("span", "ghost-chip", runtimeState.extraLabel));
    }

    nextControls.push(
      createButton(runtimeState.actionLabel || "Run", {
        disabled: Boolean(runtimeState.disabled),
        title: runtimeState.disabledReason,
        onClick: () => safeOptions.onInvoke?.(item),
      }),
    );

    if (runtimeState.showAbort) {
      nextControls.push(
        createButton("Abort", {
          disabled: Boolean(runtimeState.abortDisabled),
          onClick: () => safeOptions.onAbort?.(item),
        }),
      );
    }

    replaceRegionContent(controls, nextControls);
  }

  if (result) {
    appendChildren(result, [
      createJsonBlock(record ?? { status: "idle", message: "Awaiting runtime wiring" }, "polite"),
    ]);
  }
};

export const renderApiGroup = (
  container,
  group = {},
  items = [],
  callRecords = {},
  options = {},
) => {
  if (!(container instanceof Element)) {
    return;
  }

  const safeItems = normalizeArray(items);
  const safeCallRecords = normalizeObject(callRecords);
  const normalizedGroup = normalizeObject(group);
  const normalizedOptions = normalizeObject(options);
  const title = toText(normalizedGroup.title, "API Group");
  const existingGrid = container.querySelector(".api-grid");
  const grid = existingGrid ?? createElement("div", "api-grid");
  const existingCards = new Map(
    Array.from(grid.querySelectorAll(".api-card")).map((card) => [card.dataset.apiId, card]),
  );
  const nextIds = new Set();
  const orderedCards = [];

  for (let index = 0; index < safeItems.length; index += 1) {
    const item = normalizeObject(safeItems[index]);
    const itemId = toText(item.id, `api-item-${index}`);
    const existingCard = existingCards.get(itemId);
    const card = existingCard ?? createApiCard(itemId);

    nextIds.add(itemId);
    updateApiCard(card, item, safeCallRecords[itemId], {
      formValues: normalizedOptions.forms?.[itemId],
      runtimeState: normalizedOptions.runtimeStateById?.[itemId],
      onFormChange: normalizedOptions.onFormChange,
      onPresetChange: normalizedOptions.onPresetChange,
      onInvoke: normalizedOptions.onInvoke,
      onAbort: normalizedOptions.onAbort,
    });
    orderedCards.push(card);
  }

  for (const [itemId, card] of existingCards) {
    if (!nextIds.has(itemId)) {
      card.remove();
    }
  }

  appendChildren(grid, orderedCards);
  const panel = ensurePanelFrame(container, title);
  setText(panel.title, title);
  replaceRegionContent(panel.status, [
    createElement("span", "panel-note", `${safeItems.length} endpoints`),
  ]);

  if (grid.parentNode !== panel.body) {
    panel.body.appendChild(grid);
  }
};

export const renderLogPanel = (container, logs = [], options = {}) => {
  if (!(container instanceof Element)) {
    return;
  }

  const panel = ensurePanelFrame(container, "Events & Logs");
  const safeLogs = normalizeArray(logs);
  const safeOptions = normalizeObject(options);
  const filters = normalizeObject(safeOptions.filters);
  const toolbar = ensureRegion(panel.body, '[data-role="log-toolbar"]', () => {
    const nextToolbar = createElement("div", "api-controls");
    nextToolbar.dataset.role = "log-toolbar";
    return nextToolbar;
  });
  const list = ensureRegion(panel.body, ".log-list", () => createElement("div", "log-list"));
  const emptyState = ensureRegion(panel.body, '[data-role="log-empty"]', () => {
    const state = createEmptyState("No log entries yet.");
    state.dataset.role = "log-empty";
    return state;
  });
  const existingRows = new Map(
    Array.from(list.querySelectorAll(".log-row")).map((row) => [row.dataset.logKey, row]),
  );

  list.setAttribute("role", "log");
  list.setAttribute("aria-live", "polite");
  list.setAttribute("aria-relevant", "additions text");
  list.setAttribute("aria-atomic", "false");

  const sourceFilter = document.createElement("select");
  const levelFilter = document.createElement("select");

  for (const value of normalizeArray(safeOptions.availableSources ?? ["all"])) {
    const option = document.createElement("option");
    option.value = toText(value);
    option.textContent = `source: ${toText(value)}`;
    option.selected = toText(filters.source, "all") === option.value;
    sourceFilter.appendChild(option);
  }

  for (const value of normalizeArray(safeOptions.availableLevels ?? ["all"])) {
    const option = document.createElement("option");
    option.value = toText(value);
    option.textContent = `level: ${toText(value)}`;
    option.selected = toText(filters.level, "all") === option.value;
    levelFilter.appendChild(option);
  }

  if (typeof safeOptions.onFilterChange === "function") {
    sourceFilter.addEventListener("change", (event) => {
      safeOptions.onFilterChange("source", event.currentTarget?.value ?? "all");
    });
    levelFilter.addEventListener("change", (event) => {
      safeOptions.onFilterChange("level", event.currentTarget?.value ?? "all");
    });
  }

  replaceRegionContent(toolbar, [
    sourceFilter,
    levelFilter,
    createButton("Copy logs", {
      disabled: !safeLogs.length,
      onClick: () => safeOptions.onCopy?.(),
    }),
    createButton("Clear logs", {
      disabled: !safeLogs.length,
      onClick: () => safeOptions.onClear?.(),
    }),
  ]);

  const orderedRows = safeLogs.map((rawEntry, index) => {
    const entry = normalizeObject(rawEntry);
    const key = toText(entry.id, `log-${index}`);
    const existingRow = existingRows.get(key);
    const row = existingRow ?? createElement("article", "log-row");
    let meta = row.querySelector(".log-row__meta");
    let timestamp = meta?.children?.[0] ?? null;
    let levelNode = meta?.children?.[1] ?? null;
    let source = meta?.children?.[2] ?? null;
    let message = row.querySelector(".log-message");
    let detail = row.querySelector(".log-detail");

    row.dataset.logKey = key;

    if (!meta) {
      meta = createElement("div", "log-row__meta");
      timestamp = createElement("span");
      levelNode = createElement("span");
      source = createElement("span");
      meta.append(timestamp, levelNode, source);
      row.appendChild(meta);
    }

    if (!message) {
      message = createElement("p", "log-message");
      row.appendChild(message);
    }

    if (!detail) {
      detail = createElement("div", "log-detail");
      row.appendChild(detail);
    }

    const level = toText(entry.level, "info");
    setText(timestamp, toText(entry.timestamp));
    setText(levelNode, level);
    levelNode.className = `log-level ${level}`;
    setText(source, toText(entry.source, "unknown"));
    setText(message, toText(entry.message));
    replaceRegionContent(detail, [createJsonBlock(entry.detail ?? entry)]);

    return row;
  });

  reconcileChildOrder(list, orderedRows);
  setHidden(list, !safeLogs.length);
  setHidden(emptyState, Boolean(safeLogs.length));

  replaceRegionContent(panel.status, [
    createElement("span", "status-copy", `${safeLogs.length} entries`),
  ]);
};

export const renderCssVariablePanel = (container, cssVariables = {}) => {
  if (!(container instanceof Element)) {
    return;
  }

  const panel = ensurePanelFrame(container, "CSS Variables");
  const entries = Object.entries(normalizeObject(cssVariables));
  const grid = ensureRegion(panel.body, ".css-var-grid", () =>
    createElement("div", "css-var-grid"),
  );
  const emptyState = ensureRegion(panel.body, '[data-role="css-vars-empty"]', () => {
    const state = createEmptyState("No CSS variables captured yet.");
    state.dataset.role = "css-vars-empty";
    return state;
  });
  const existingCards = new Map(
    Array.from(grid.querySelectorAll(".css-var-card")).map((card) => [
      card.dataset.cssVarName,
      card,
    ]),
  );

  grid.setAttribute("aria-live", "polite");
  grid.setAttribute("aria-atomic", "true");

  const orderedCards = entries.map(([name, value]) => {
    const key = toText(name);
    const existingCard = existingCards.get(key);
    const card = existingCard ?? createElement("article", "css-var-card");
    let label = card.querySelector("strong");
    let content = card.querySelector("span");

    card.dataset.cssVarName = key;

    if (!label) {
      label = createElement("strong");
      card.appendChild(label);
    }

    if (!content) {
      content = createElement("span");
      card.appendChild(content);
    }

    setText(label, key);
    setText(content, toText(value, "(empty)") || "(empty)");

    return card;
  });

  reconcileChildOrder(grid, orderedCards);
  setHidden(grid, !entries.length);
  setHidden(emptyState, Boolean(entries.length));

  replaceRegionContent(panel.status, [
    createElement("span", "status-copy", `${entries.length} variables`),
  ]);
};

export const renderSafeAreaLab = (container, mode = {}) => {
  if (!(container instanceof Element)) {
    return;
  }

  const panel = ensurePanelFrame(container, "Safe Area Lab");
  const safeMode = normalizeObject(mode);
  const heightMode = toText(safeMode.height, "viewport");
  const bottomMode = toText(safeMode.bottom, "content-safe-area");
  const controls = ensureRegion(panel.body, '[data-role="safe-area-controls"]', () => {
    const nextControls = createElement("div", "api-controls");
    nextControls.dataset.role = "safe-area-controls";
    return nextControls;
  });
  const demo = ensureRegion(panel.body, ".safe-area-demo", () => {
    const nextDemo = createElement("div", "safe-area-demo");
    nextDemo.appendChild(createElement("div", "safe-area-demo__header", "Sticky Header"));
    nextDemo.appendChild(
      createElement(
        "div",
        "safe-area-demo__body",
        "Scrollable content preview with safe-area-aware spacing and room for later controls.",
      ),
    );
    nextDemo.appendChild(createElement("div", "safe-area-demo__footer", "Fixed Action Bar"));
    return nextDemo;
  });

  demo.dataset.heightMode = heightMode;
  demo.dataset.bottomMode = bottomMode;

  const heightSelect = document.createElement("select");
  const bottomSelect = document.createElement("select");
  const heightModes = [
    { value: "vh", label: "100vh" },
    { value: "viewport", label: "var(--tgg-viewport-height)" },
    { value: "stable", label: "var(--tgg-viewport-stable-height)" },
  ];
  const bottomModes = [
    { value: "safe-area", label: "env(safe-area-inset-bottom)" },
    { value: "content-safe-area", label: "var(--tgg-content-safe-area-inset-bottom)" },
  ];

  for (const optionConfig of heightModes) {
    const option = document.createElement("option");
    option.value = optionConfig.value;
    option.textContent = optionConfig.label;
    option.selected = heightMode === optionConfig.value;
    heightSelect.appendChild(option);
  }

  for (const optionConfig of bottomModes) {
    const option = document.createElement("option");
    option.value = optionConfig.value;
    option.textContent = optionConfig.label;
    option.selected = bottomMode === optionConfig.value;
    bottomSelect.appendChild(option);
  }

  if (typeof safeMode.onModeChange === "function") {
    heightSelect.addEventListener("change", (event) => {
      safeMode.onModeChange("height", event.currentTarget?.value ?? "viewport");
    });
    bottomSelect.addEventListener("change", (event) => {
      safeMode.onModeChange("bottom", event.currentTarget?.value ?? "content-safe-area");
    });
  }

  replaceRegionContent(controls, [
    createField("height", heightSelect),
    createField("bottom", bottomSelect),
  ]);

  replaceRegionContent(panel.status, [
    createElement("span", "status-copy", `height: ${heightMode} / bottom: ${bottomMode}`),
  ]);

  if (controls.parentNode !== panel.body) {
    panel.body.appendChild(controls);
  }

  if (demo.parentNode !== panel.body) {
    panel.body.appendChild(demo);
  }
};
