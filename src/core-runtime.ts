import {
  SDK_VERSION,
  TGG_EVENT_GLOBAL_NAME,
  TGG_GLOBAL_NAME,
  TGG_HAS_EVENT_HANDLERS_GLOBAL_NAME,
} from "./constants";
import { getRuntimeGlobal } from "./runtime";
import {
  createMiniAppSDK,
  hasMiniAppSDKEventHandlers,
  NATIVE_METHOD_CAPABILITIES,
  receiveMiniAppSDKEvent,
} from "./sdk";
import type {
  InitData,
  MiniAppMethod,
  SafeAreaInset,
  TggColorScheme,
  TggEventName,
  TggRuntimeOptions,
  ThemeParams,
  TggWebApp,
} from "./types";

export const createTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const sdk = createMiniAppSDK(options);
  const runtimeMetadata = {
    appVersion: options.appVersion ?? "",
    colorScheme: options.colorScheme ?? "light",
    platform: options.platform ?? "web",
    sdkVersion: options.sdkVersion ?? SDK_VERSION,
    version: options.version ?? SDK_VERSION,
    themeParams: normalizeThemeParams(options.themeParams),
    viewportHeight: normalizeDimension(options.viewportHeight),
    viewportStableHeight: normalizeDimension(options.viewportStableHeight),
    headerColor: options.headerColor ?? "",
    backgroundColor: options.backgroundColor ?? "",
    isFullscreen: options.isFullscreen ?? false,
    safeAreaInset: normalizeSafeAreaInset(options.safeAreaInset),
    contentSafeAreaInset: normalizeSafeAreaInset(options.contentSafeAreaInset),
  } satisfies {
    appVersion: string;
    colorScheme: TggColorScheme;
    platform: string;
    sdkVersion: string;
    version: string;
    themeParams: ThemeParams;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    isFullscreen: boolean;
    safeAreaInset: SafeAreaInset;
    contentSafeAreaInset: SafeAreaInset;
  };

  syncCssVariables(runtimeMetadata);

  const init = async (): Promise<InitData> => {
    const initData = await sdk.init();
    applyInitData(runtimeMetadata, initData);
    syncCssVariables(runtimeMetadata);
    return initData;
  };

  const runtime: TggWebApp = {
    ...sdk,
    init,
    get appVersion() {
      return runtimeMetadata.appVersion;
    },
    get colorScheme() {
      return runtimeMetadata.colorScheme;
    },
    get platform() {
      return runtimeMetadata.platform;
    },
    get sdkVersion() {
      return runtimeMetadata.sdkVersion;
    },
    get version() {
      return runtimeMetadata.version;
    },
    get themeParams() {
      return runtimeMetadata.themeParams;
    },
    get viewportHeight() {
      return runtimeMetadata.viewportHeight;
    },
    get viewportStableHeight() {
      return runtimeMetadata.viewportStableHeight;
    },
    get headerColor() {
      return runtimeMetadata.headerColor;
    },
    get backgroundColor() {
      return runtimeMetadata.backgroundColor;
    },
    get isFullscreen() {
      return runtimeMetadata.isFullscreen;
    },
    get safeAreaInset() {
      return runtimeMetadata.safeAreaInset;
    },
    get contentSafeAreaInset() {
      return runtimeMetadata.contentSafeAreaInset;
    },
  };

  const global = getRuntimeGlobal();
  global[TGG_GLOBAL_NAME] = runtime;
  global[TGG_EVENT_GLOBAL_NAME] = (eventName: string, payload?: unknown) => {
    applyRuntimeEvent(runtimeMetadata, eventName as TggEventName, payload);
    syncCssVariables(runtimeMetadata);
    receiveMiniAppSDKEvent(sdk, eventName as TggEventName, payload);
    dispatchTggCustomEvent(eventName, payload);
  };
  global[TGG_HAS_EVENT_HANDLERS_GLOBAL_NAME] = (eventName: string) => {
    return hasMiniAppSDKEventHandlers(sdk, eventName);
  };

  return runtime;
};

export const installTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const global = getRuntimeGlobal();
  const currentRuntime = global[TGG_GLOBAL_NAME] as TggWebApp | undefined;

  if (
    typeof currentRuntime?.init === "function" &&
    typeof currentRuntime.canIUse === "function" &&
    typeof currentRuntime.isVersionAtLeast === "function" &&
    currentRuntime.BackButton
  ) {
    return currentRuntime;
  }

  return createTggRuntime(options);
};

export const getSupportedCapabilities = (): readonly MiniAppMethod[] =>
  Array.from(NATIVE_METHOD_CAPABILITIES);

const dispatchTggCustomEvent = (eventName: string, payload?: unknown): void => {
  const global = getRuntimeGlobal() as typeof globalThis & {
    CustomEvent?: typeof CustomEvent;
    dispatchEvent?: (event: Event) => boolean;
  };

  if (typeof global.dispatchEvent !== "function" || typeof global.CustomEvent !== "function") {
    return;
  }

  global.dispatchEvent(
    new global.CustomEvent("tgg:event", {
      detail: {
        eventName,
        payload,
      },
    }),
  );
};

type RuntimeMetadata = {
  appVersion: string;
  colorScheme: TggColorScheme;
  platform: string;
  sdkVersion: string;
  version: string;
  themeParams: ThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isFullscreen: boolean;
  safeAreaInset: SafeAreaInset;
  contentSafeAreaInset: SafeAreaInset;
};

const DEFAULT_SAFE_AREA_INSET: SafeAreaInset = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const applyInitData = (runtimeMetadata: RuntimeMetadata, initData: InitData): void => {
  runtimeMetadata.appVersion = initData.appVersion;
  runtimeMetadata.colorScheme = initData.colorScheme;
  runtimeMetadata.platform = initData.platform;
  runtimeMetadata.sdkVersion = initData.sdkVersion;
  runtimeMetadata.themeParams = normalizeThemeParams(initData.themeParams);
  runtimeMetadata.viewportHeight = normalizeDimension(initData.viewportHeight);
  runtimeMetadata.viewportStableHeight = normalizeDimension(initData.viewportStableHeight);
  runtimeMetadata.headerColor = initData.headerColor ?? "";
  runtimeMetadata.backgroundColor = initData.backgroundColor ?? "";
  runtimeMetadata.isFullscreen = initData.isFullscreen ?? false;
  runtimeMetadata.safeAreaInset = normalizeSafeAreaInset(initData.safeAreaInset);
  runtimeMetadata.contentSafeAreaInset = normalizeSafeAreaInset(initData.contentSafeAreaInset);
};

const applyRuntimeEvent = (
  runtimeMetadata: RuntimeMetadata,
  eventName: TggEventName,
  payload?: unknown,
): void => {
  if (!isRecord(payload)) {
    if (eventName === "fullscreen_changed") {
      runtimeMetadata.isFullscreen = false;
    }
    return;
  }

  if (eventName === "theme_changed") {
    const colorScheme = getColorScheme(payload.colorScheme);
    if (colorScheme) {
      runtimeMetadata.colorScheme = colorScheme;
    }
    runtimeMetadata.themeParams = normalizeThemeParams(payload.themeParams);
    runtimeMetadata.headerColor = getString(payload.headerColor) ?? runtimeMetadata.headerColor;
    runtimeMetadata.backgroundColor =
      getString(payload.backgroundColor) ?? runtimeMetadata.backgroundColor;
    return;
  }

  if (eventName === "viewport_changed") {
    runtimeMetadata.viewportHeight = normalizeDimension(payload.height);
    runtimeMetadata.viewportStableHeight = normalizeDimension(payload.stableHeight);
    return;
  }

  if (eventName === "safe_area_changed") {
    runtimeMetadata.safeAreaInset = normalizeSafeAreaInset(payload);
    return;
  }

  if (eventName === "content_safe_area_changed") {
    runtimeMetadata.contentSafeAreaInset = normalizeSafeAreaInset(payload);
    return;
  }

  if (eventName === "fullscreen_changed") {
    runtimeMetadata.isFullscreen = Boolean(payload.isFullscreen);
  }
};

const normalizeThemeParams = (value: unknown): ThemeParams => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

const normalizeDimension = (value: unknown): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const normalizeSafeAreaInset = (value: unknown): SafeAreaInset => {
  if (!isRecord(value)) {
    return { ...DEFAULT_SAFE_AREA_INSET };
  }

  return {
    top: normalizeDimension(value.top),
    right: normalizeDimension(value.right),
    bottom: normalizeDimension(value.bottom),
    left: normalizeDimension(value.left),
  };
};

const syncCssVariables = (runtimeMetadata: RuntimeMetadata): void => {
  const root = getDocumentElementStyle();
  if (!root) {
    return;
  }

  root.setProperty("--tgg-color-scheme", runtimeMetadata.colorScheme);
  root.setProperty("--tgg-viewport-height", toPixelValue(runtimeMetadata.viewportHeight));
  root.setProperty(
    "--tgg-viewport-stable-height",
    toPixelValue(runtimeMetadata.viewportStableHeight),
  );
  root.setProperty("--tgg-header-color", runtimeMetadata.headerColor);
  root.setProperty("--tgg-background-color", runtimeMetadata.backgroundColor);
  root.setProperty("--tgg-is-fullscreen", runtimeMetadata.isFullscreen ? "1" : "0");

  setInsetCssVariables(root, "--tgg-safe-area-inset", runtimeMetadata.safeAreaInset);
  setInsetCssVariables(root, "--tgg-content-safe-area-inset", runtimeMetadata.contentSafeAreaInset);

  Object.entries(runtimeMetadata.themeParams).forEach(([key, value]) => {
    root.setProperty(`--tgg-theme-${toKebabCase(key)}`, value);
  });
};

const setInsetCssVariables = (
  root: CSSStyleDeclarationLike,
  prefix: string,
  inset: SafeAreaInset,
): void => {
  root.setProperty(`${prefix}-top`, toPixelValue(inset.top));
  root.setProperty(`${prefix}-right`, toPixelValue(inset.right));
  root.setProperty(`${prefix}-bottom`, toPixelValue(inset.bottom));
  root.setProperty(`${prefix}-left`, toPixelValue(inset.left));
};

type CSSStyleDeclarationLike = {
  setProperty(name: string, value: string): void;
};

const getDocumentElementStyle = (): CSSStyleDeclarationLike | undefined => {
  const global = getRuntimeGlobal() as {
    document?: {
      documentElement?: {
        style?: CSSStyleDeclarationLike;
      };
    };
  };

  return global.document?.documentElement?.style;
};

const toPixelValue = (value: number): string => `${value}px`;

const toKebabCase = (value: string): string => value.replaceAll("_", "-");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getColorScheme = (value: unknown): TggColorScheme | undefined =>
  value === "light" || value === "dark" ? value : undefined;
