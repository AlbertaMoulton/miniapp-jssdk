import { DEFAULT_BRIDGE_NAME, SDK_VERSION, TGG_GLOBAL_NAME } from "./constants";
import { getRuntimeGlobal } from "./runtime";
import { createMiniAppSDK } from "./sdk";
import type { MiniAppMethod, TggRuntimeOptions, TggWebApp } from "./types";

const SUPPORTED_CAPABILITIES = new Set<string>([
  "ready",
  "close",
  "setHeaderColor",
  "BackButton.show",
  "BackButton.hide",
  "getOauthCode",
  "getUserId",
  "getUserInfo",
  "getSystemInfo",
  "getCommunityId",
  "getCommunityInfo",
  "themeChanged",
  "backButtonClicked",
]);

export const createTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const sdk = createMiniAppSDK({
    bridgeName: options.bridgeName ?? DEFAULT_BRIDGE_NAME,
  });

  const runtime: TggWebApp = {
    ...sdk,
    appVersion: options.appVersion ?? "",
    platform: options.platform ?? "web",
    sdkVersion: options.sdkVersion ?? SDK_VERSION,
    version: options.version ?? SDK_VERSION,
    canIUse(capability: string) {
      return SUPPORTED_CAPABILITIES.has(capability);
    },
  };

  getRuntimeGlobal()[TGG_GLOBAL_NAME] = runtime;
  return runtime;
};

export const installTggRuntime = (options: TggRuntimeOptions = {}): TggWebApp => {
  const global = getRuntimeGlobal();
  const currentRuntime = global[TGG_GLOBAL_NAME] as TggWebApp | undefined;

  if (currentRuntime?.canIUse) {
    return currentRuntime;
  }

  return createTggRuntime(options);
};

export const getSupportedCapabilities = (): readonly MiniAppMethod[] =>
  Array.from(SUPPORTED_CAPABILITIES).filter((capability): capability is MiniAppMethod =>
    [
      "ready",
      "close",
      "setHeaderColor",
      "BackButton.show",
      "BackButton.hide",
      "getOauthCode",
      "getUserId",
      "getUserInfo",
      "getSystemInfo",
      "getCommunityId",
      "getCommunityInfo",
    ].includes(capability),
  );
