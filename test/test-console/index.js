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
  renderCssVariablePanel,
  renderEnvironmentOverview,
  renderLogPanel,
  renderSafeAreaLab,
} from "./dom.js";

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

const GROUP_CONTAINER_IDS = {
  "lifecycle-ui": "lifecycle-ui-api",
  "business-system": "business-system-api",
  device: "device-api",
};

const LOG_LIMIT = 200;

function resolveConsoleUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return value;
  }

  try {
    return new URL(value, window.location.href).href;
  } catch {
    return value;
  }
}

function buildInitialForms() {
  return Object.fromEntries(
    API_ITEMS.map((item) => {
      const defaultParams = { ...item.defaultParams };

      if (item.id === "downloadFile" && typeof defaultParams.url === "string") {
        defaultParams.url = resolveConsoleUrl(defaultParams.url);
      }

      return [item.id, defaultParams];
    }),
  );
}

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
  eventSubscriptions: {},
  eventPayloads: {},
  downloadTask: null,
  safeAreaMode: {
    height: "viewport",
    bottom: "content-safe-area",
  },
  logFilters: {
    source: "all",
    level: "all",
  },
  forms: buildInitialForms(),
};

const containers = {
  environment: document.getElementById("environment-overview"),
  logs: document.getElementById("event-log"),
  cssVars: document.getElementById("css-vars"),
  safeArea: document.getElementById("safe-area-lab"),
  groups: Object.fromEntries(
    API_GROUPS.map((group) => [group.id, document.getElementById(GROUP_CONTAINER_IDS[group.id])]),
  ),
};

function detectTransport() {
  if (typeof window.flutter_inappwebview?.callHandler === "function") {
    return "flutter_inappwebview";
  }

  if (typeof window.nativeBridge?.postMessage === "function") {
    return "webview_flutter";
  }

  return "browser_only";
}

function getRuntime() {
  return window.tgg && typeof window.tgg === "object" ? window.tgg : null;
}

function readRuntimeValue(runtime, key) {
  try {
    return runtime?.[key] ?? null;
  } catch (error) {
    return `[Read failed: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

function serializeValue(value, seen = new WeakSet(), depth = 0) {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
      ...(value.code ? { code: value.code } : {}),
    };
  }

  if (depth > 6) {
    return "[Max depth exceeded]";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry, seen, depth + 1));
  }

  return Object.fromEntries(
    Reflect.ownKeys(value).map((key) => [
      typeof key === "symbol" ? key.toString() : String(key),
      serializeValue(readRuntimeValue(value, key), seen, depth + 1),
    ]),
  );
}

function serializeError(error) {
  const serialized =
    error && typeof error === "object" && "errMsg" in error
      ? serializeValue(error)
      : error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack ?? null,
            ...(error.code ? { code: error.code } : {}),
          }
        : {
            message: typeof error === "string" ? error : "Unknown error",
            detail: serializeValue(error),
          };

  return annotateMiniAppError(serialized);
}

function annotateMiniAppError(error) {
  const serialized = serializeValue(error);
  const message =
    typeof serialized?.message === "string"
      ? serialized.message
      : typeof serialized?.errMsg === "string"
        ? serialized.errMsg
        : "";
  const unknownMethodMatch = message.match(/^Unknown miniapp method: (.+)$/u);

  if (!unknownMethodMatch) {
    return serialized;
  }

  return {
    ...serialized,
    category: "host_capability_missing",
    missingMethod: unknownMethodMatch[1],
    friendlyMessage: `Host runtime does not implement miniapp method: ${unknownMethodMatch[1]}`,
  };
}

function pickRuntimeFields(runtime) {
  return Object.fromEntries(
    ENVIRONMENT_FIELDS.map((field) => [field, serializeValue(readRuntimeValue(runtime, field))]),
  );
}

function collectThemeCssVariables(style) {
  const entries = [];

  if (!style) {
    return {};
  }

  const length = Number.isFinite(style.length) ? style.length : 0;

  for (let index = 0; index < length; index += 1) {
    const name = style.item?.(index) ?? style[index];

    if (typeof name === "string" && name.startsWith("--tgg-theme-")) {
      entries.push([name, style.getPropertyValue(name).trim()]);
    }
  }

  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function refreshCssVariables() {
  const root = document.documentElement;

  if (!root) {
    state.cssVariables = {};
    return;
  }

  const computedStyle = window.getComputedStyle(root);

  state.cssVariables = {
    ...collectCssVariables(computedStyle),
    ...collectThemeCssVariables(computedStyle),
  };
}

function pushLog(source, level, message, detail) {
  state.logs = [
    createLogEntry({
      source,
      level,
      message,
      detail: detail == null ? null : serializeValue(detail),
    }),
    ...state.logs,
  ].slice(0, LOG_LIMIT);
}

function getCapabilityName(item) {
  switch (item.id) {
    case "backButtonShow":
      return "BackButton.show";
    case "backButtonHide":
      return "BackButton.hide";
    case "backButtonBind":
    case "backButtonUnbind":
      return "back_button_clicked";
    case "activated":
    case "deactivated":
    case "theme_changed":
    case "viewport_changed":
    case "safe_area_changed":
    case "content_safe_area_changed":
    case "fullscreen_failed":
    case "clipboard_text_received":
      return item.id;
    default:
      return item.title;
  }
}

function buildCapabilitySnapshot() {
  const runtime = getRuntime();

  return Object.fromEntries(
    API_ITEMS.map((item) => {
      const capability = getCapabilityName(item);
      const supported =
        typeof runtime?.canIUse === "function" ? runtime.canIUse(capability) : false;

      return [capability, supported];
    }),
  );
}

function buildVersionChecks() {
  const runtime = getRuntime();

  return Object.fromEntries(
    VERSION_PRESETS.map((version) => [
      version,
      typeof runtime?.isVersionAtLeast === "function" ? runtime.isVersionAtLeast(version) : false,
    ]),
  );
}

function syncSnapshot({
  initData = state.snapshot.initData,
  initError = state.snapshot.initError,
} = {}) {
  const runtime = getRuntime();

  state.snapshot = buildEnvironmentSnapshot({
    injected: Boolean(runtime),
    transport: detectTransport(),
    initData: initData ?? null,
    initError: initError ?? null,
    runtime: runtime ? pickRuntimeFields(runtime) : null,
  });
}

async function refreshEnvironment() {
  const runtime = getRuntime();

  if (!runtime) {
    state.snapshot = buildEnvironmentSnapshot({
      injected: false,
      transport: detectTransport(),
      initError: { message: "window.tgg is not injected" },
    });
    return;
  }

  try {
    const initData = await runtime.init();

    syncSnapshot({ initData, initError: null });
  } catch (error) {
    syncSnapshot({ initError: serializeError(error) });
  }
}

function getFormParams(itemId) {
  return { ...state.forms[itemId] };
}

function setFormValue(itemId, key, value) {
  state.forms[itemId] = {
    ...state.forms[itemId],
    [key]: value,
  };
}

function buildRecordResult(result) {
  return result == null ? null : serializeValue(result);
}

function updateClipboardRecord(payload) {
  const receivedAt = new Date().toISOString();

  state.clipboard = {
    receivedAt,
    payload: serializeValue(payload),
  };
  state.callRecords.clipboard_text_received = buildCallRecord({
    name: "clipboard_text_received",
    params: null,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    status: "success",
    result: state.clipboard,
  });
}

function updateEventRecord(itemId, payload) {
  const receivedAt = new Date().toISOString();

  state.eventPayloads[itemId] = {
    receivedAt,
    payload: serializeValue(payload),
  };
  state.callRecords[itemId] = buildCallRecord({
    name: itemId,
    params: null,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    status: "success",
    result: {
      listening: true,
      latest: state.eventPayloads[itemId],
    },
  });
}

function updateDownloadState(status, patch = {}) {
  state.downloadTask = {
    ...state.downloadTask,
    status,
    ...patch,
  };
}

function applyRuntimeEvent(eventName, payload) {
  if (eventName === "back_button_clicked") {
    state.backButtonClicks += 1;
  }

  if (eventName === "clipboard_text_received") {
    updateClipboardRecord(payload);
  }

  if (eventName === "download_file_progress") {
    updateDownloadState("running", {
      progress: payload?.progress ?? state.downloadTask?.progress ?? 0,
      progressPayload: serializeValue(payload),
    });
  }

  if (eventName === "download_file_success") {
    updateDownloadState("success", {
      progress: 100,
      successPayload: serializeValue(payload),
    });
  }

  if (eventName === "download_file_fail") {
    updateDownloadState("error", {
      errorPayload: serializeValue(payload),
    });
  }

  syncSnapshot();
  refreshCssVariables();
  pushLog("event", "info", `${eventName} received`, payload);
  refreshAll();
}

function registerRuntimeListeners() {
  window.addEventListener("tgg:event", (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;

    if (!detail || typeof detail !== "object") {
      return;
    }

    applyRuntimeEvent(detail.eventName, detail.payload);
  });

  pushLog("system", "info", `Detected transport: ${detectTransport()}`, {
    injected: Boolean(getRuntime()),
  });
}

async function startDownloadTask(params) {
  const runtime = getRuntime();

  if (!runtime) {
    throw new Error("window.tgg is not injected");
  }

  if (state.downloadTask?.status === "running") {
    throw new Error("downloadFile already running");
  }

  return await new Promise((resolve, reject) => {
    const resolvedUrl = resolveConsoleUrl(params.url);
    const task = runtime.downloadFile({
      url: resolvedUrl,
      success(result) {
        updateDownloadState("success", {
          progress: 100,
          successPayload: serializeValue(result),
        });
        resolve(result);
      },
      fail(error) {
        const serialized = serializeError(error);
        const isAbort =
          serialized?.message === "downloadFile:abort" ||
          serialized?.errMsg === "downloadFile:abort";

        updateDownloadState(isAbort ? "aborted" : "error", {
          errorPayload: serialized,
        });
        reject(error);
      },
      complete(result) {
        updateDownloadState(state.downloadTask?.status ?? "idle", {
          completePayload: serializeValue(result),
        });
        refreshAll();
      },
    });

    task.onProgressUpdate((progressPayload) => {
      updateDownloadState("running", {
        progress: progressPayload?.progress ?? state.downloadTask?.progress ?? 0,
        progressPayload: serializeValue(progressPayload),
      });
      refreshAll();
    });

    state.downloadTask = {
      task,
      status: "running",
      params: serializeValue({
        ...params,
        url: resolvedUrl,
      }),
      progress: 0,
      startedAt: new Date().toISOString(),
    };
  });
}

async function invokeItem(item, params) {
  const runtime = getRuntime();

  if (!runtime) {
    throw new Error("window.tgg is not injected");
  }

  switch (item.id) {
    case "init":
      return await runtime.init();
    case "ready":
      return await runtime.ready();
    case "close":
      return await runtime.close();
    case "setHeaderColor":
      return await runtime.setHeaderColor(params.color);
    case "backButtonShow":
      return await runtime.BackButton.show();
    case "backButtonHide":
      return await runtime.BackButton.hide();
    case "backButtonBind": {
      if (!state.boundBackButtonHandler) {
        state.boundBackButtonHandler = () => {
          pushLog("system", "info", "BackButton.onClick handler invoked", {
            clicks: state.backButtonClicks,
          });
        };
        runtime.BackButton.onClick(state.boundBackButtonHandler);
      }

      return {
        bound: true,
        isVisible: Boolean(runtime.BackButton?.isVisible),
      };
    }
    case "backButtonUnbind":
      if (state.boundBackButtonHandler) {
        runtime.BackButton.offClick(state.boundBackButtonHandler);
        state.boundBackButtonHandler = null;
      }
      return {
        bound: false,
        isVisible: Boolean(runtime.BackButton?.isVisible),
      };
    case "getOauthCode":
      return await runtime.getOauthCode();
    case "getUserId":
      return await runtime.getUserId();
    case "getUserInfo":
      return await runtime.getUserInfo();
    case "getSystemInfo":
      return await runtime.getSystemInfo();
    case "getCommunityId":
      return await runtime.getCommunityId();
    case "getCommunityInfo":
      return await runtime.getCommunityInfo();
    case "downloadFile":
      return await startDownloadTask(params);
    case "savePhoto":
      return await runtime.savePhoto(params);
    case "saveVideo":
      return await runtime.saveVideo(params);
    case "activated":
    case "deactivated":
    case "theme_changed":
    case "viewport_changed":
    case "safe_area_changed":
    case "content_safe_area_changed":
    case "fullscreen_failed":
    case "clipboard_text_received": {
      if (!state.eventSubscriptions[item.id]) {
        const callback = (payload) => {
          updateEventRecord(item.id, payload);
          pushLog("system", "info", `${item.title} callback invoked`, payload);
          refreshAll();
        };

        runtime.onEvent(item.id, callback);
        state.eventSubscriptions[item.id] = {
          active: true,
          unsubscribe: () => runtime.offEvent(item.id, callback),
          subscribedAt: new Date().toISOString(),
        };
      }

      return {
        listening: true,
        subscribedAt: state.eventSubscriptions[item.id]?.subscribedAt ?? null,
        latest: state.eventPayloads[item.id] ?? null,
      };
    }
    default:
      throw new Error(`Unsupported API item: ${item.id}`);
  }
}

async function executeApi(item) {
  const params = getFormParams(item.id);
  const startedAt = Date.now();

  try {
    const result = await invokeItem(item, params);

    state.callRecords[item.id] = buildCallRecord({
      name: item.title,
      params,
      startedAt,
      finishedAt: Date.now(),
      status: "success",
      result: buildRecordResult(result),
    });
    pushLog("api", "info", `${item.title} succeeded`, result);

    if (item.id === "init") {
      syncSnapshot({ initData: result, initError: null });
    } else {
      syncSnapshot();
    }
  } catch (error) {
    state.callRecords[item.id] = buildCallRecord({
      name: item.title,
      params,
      startedAt,
      finishedAt: Date.now(),
      status: "error",
      error: serializeError(error),
    });
    pushLog("api", "error", `${item.title} failed`, error);
    syncSnapshot({
      initError: item.id === "init" ? serializeError(error) : state.snapshot.initError,
    });
  }

  refreshCssVariables();
  refreshAll();
}

function getApiRuntimeState(item) {
  const runtime = getRuntime();
  const isInjected = Boolean(runtime);
  const isDownload = item.id === "downloadFile";
  const isEvent = item.kind === "event";
  const lastError = state.callRecords[item.id]?.error;
  const hostCapabilityMissing = lastError?.category === "host_capability_missing";
  const capability = getCapabilityName(item);
  const capabilityKnown =
    typeof runtime?.canIUse === "function" ? runtime.canIUse(capability) : null;
  const disabled = !isInjected || (capabilityKnown === false && item.kind !== "event");

  return {
    disabled,
    disabledReason: hostCapabilityMissing
      ? (lastError?.friendlyMessage ?? "Host runtime does not implement this miniapp method")
      : !isInjected
        ? "window.tgg is not injected"
        : capabilityKnown === false
          ? `Capability unavailable: ${capability}`
          : "",
    actionLabel: isEvent
      ? "Bind listener"
      : item.id === "backButtonBind"
        ? "Bind"
        : item.id === "backButtonUnbind"
          ? "Unbind"
          : "Run",
    boundLabel:
      item.id === "backButtonBind" || item.id === "backButtonUnbind"
        ? `listener: ${state.boundBackButtonHandler ? "bound" : "idle"}`
        : isEvent
          ? `listener: ${state.eventSubscriptions[item.id]?.active ? "bound" : "idle"}`
          : "",
    extraLabel:
      item.id === "backButtonBind" || item.id === "backButtonUnbind"
        ? `clicks: ${state.backButtonClicks} / visible: ${runtime?.BackButton?.isVisible ? "yes" : "no"}`
        : isDownload
          ? `task: ${state.downloadTask?.status ?? "idle"} / progress: ${state.downloadTask?.progress ?? 0}%`
          : isEvent
            ? `last event: ${state.eventPayloads[item.id]?.receivedAt ?? "none"}`
            : hostCapabilityMissing
              ? `host missing: ${lastError?.missingMethod ?? capability}`
              : "",
    showAbort: isDownload,
    abortDisabled: state.downloadTask?.status !== "running",
  };
}

function getVisibleLogs() {
  return state.logs.filter((entry) => {
    const sourceMatch =
      state.logFilters.source === "all" || entry.source === state.logFilters.source;
    const levelMatch = state.logFilters.level === "all" || entry.level === state.logFilters.level;

    return sourceMatch && levelMatch;
  });
}

async function copyLogs() {
  const payload = JSON.stringify(getVisibleLogs(), null, 2);

  if (!navigator.clipboard?.writeText) {
    pushLog("system", "warn", "Clipboard API unavailable for log copy");
    refreshAll();
    return;
  }

  try {
    await navigator.clipboard.writeText(payload);
    pushLog("system", "info", "Copied visible logs to clipboard", {
      count: getVisibleLogs().length,
    });
  } catch (error) {
    pushLog("system", "error", "Failed to copy logs", error);
  }

  refreshAll();
}

function clearLogs() {
  state.logs = [];
  refreshAll();
}

function refreshAll() {
  const diff = buildEnvironmentDiff(state.snapshot);
  const runtimeStateById = Object.fromEntries(
    API_ITEMS.map((item) => [item.id, getApiRuntimeState(item)]),
  );

  renderEnvironmentOverview(
    containers.environment,
    state.snapshot,
    diff,
    buildCapabilitySnapshot(),
    buildVersionChecks(),
  );

  for (const group of API_GROUPS) {
    renderApiGroup(
      containers.groups[group.id],
      group,
      API_ITEMS.filter((item) => item.group === group.id),
      state.callRecords,
      {
        forms: state.forms,
        runtimeStateById,
        onFormChange(itemId, key, value) {
          setFormValue(itemId, key, value);
        },
        onPresetChange(itemId, value) {
          setFormValue(itemId, "color", value);
          refreshAll();
        },
        onInvoke(item) {
          void executeApi(item);
        },
        onAbort(item) {
          if (item.id === "downloadFile" && state.downloadTask?.task?.abort) {
            state.downloadTask.task.abort();
            pushLog("api", "warn", "downloadFile abort requested", {
              status: state.downloadTask.status,
            });
            refreshAll();
          }
        },
      },
    );
  }

  renderLogPanel(containers.logs, getVisibleLogs(), {
    filters: state.logFilters,
    availableSources: ["all", ...new Set(state.logs.map((entry) => entry.source))],
    availableLevels: ["all", ...new Set(state.logs.map((entry) => entry.level))],
    onFilterChange(key, value) {
      state.logFilters[key] = value;
      refreshAll();
    },
    onCopy() {
      void copyLogs();
    },
    onClear() {
      clearLogs();
    },
  });
  renderCssVariablePanel(containers.cssVars, state.cssVariables);
  renderSafeAreaLab(containers.safeArea, {
    ...state.safeAreaMode,
    onModeChange(key, value) {
      state.safeAreaMode[key] = value;
      refreshAll();
    },
  });
}

async function bootstrap() {
  registerRuntimeListeners();
  refreshCssVariables();
  refreshAll();
  await refreshEnvironment();
  refreshCssVariables();
  refreshAll();
}

void bootstrap();
