import { SDK_VERSION, TGG_EVENT_GLOBAL_NAME, TGG_GLOBAL_NAME } from "./constants";
import { getRuntimeGlobal } from "./runtime";
import { createMiniAppSDK, NATIVE_METHOD_CAPABILITIES } from "./sdk";
import type {
  InitData,
  MiniAppMethod,
  TggColorScheme,
  TggEventName,
  TggRuntimeOptions,
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
  } satisfies {
    appVersion: string;
    colorScheme: TggColorScheme;
    platform: string;
    sdkVersion: string;
    version: string;
  };

  const init = async (): Promise<InitData> => {
    const initData = await sdk.init();
    runtimeMetadata.appVersion = initData.appVersion;
    runtimeMetadata.colorScheme = initData.colorScheme;
    runtimeMetadata.platform = initData.platform;
    runtimeMetadata.sdkVersion = initData.sdkVersion;
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
  };

  const global = getRuntimeGlobal();
  global[TGG_GLOBAL_NAME] = runtime;
  global[TGG_EVENT_GLOBAL_NAME] = (eventName: string, payload?: unknown) => {
    runtime.receiveEvent(eventName as TggEventName, payload);
    dispatchTggCustomEvent(eventName, payload);
  };

  return runtime;
};

export const installTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const global = getRuntimeGlobal();
  const currentRuntime = global[TGG_GLOBAL_NAME] as TggWebApp | undefined;

  if (
    typeof currentRuntime?.invoke === "function" &&
    typeof currentRuntime.init === "function" &&
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
