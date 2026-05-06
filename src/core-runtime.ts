import { SDK_VERSION, TGG_EVENT_GLOBAL_NAME, TGG_GLOBAL_NAME } from "./constants";
import { getRuntimeGlobal } from "./runtime";
import { createMiniAppSDK, NATIVE_METHOD_CAPABILITIES } from "./sdk";
import type { MiniAppMethod, TggEventName, TggRuntimeOptions, TggWebApp } from "./types";

export const createTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const sdk = createMiniAppSDK(options);

  const runtime: TggWebApp = {
    ...sdk,
    appVersion: options.appVersion ?? "",
    platform: options.platform ?? "web",
    sdkVersion: options.sdkVersion ?? SDK_VERSION,
    version: options.version ?? SDK_VERSION,
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
    typeof currentRuntime.canIUse === "function" &&
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
