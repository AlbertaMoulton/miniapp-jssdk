export {
  TeamGagaMiniApp,
  createMiniAppSDK,
  getTgg,
  getCommunityId,
  getCommunityInfo,
  getOauthCode,
  getSystemInfo,
  getUserId,
  getUserInfo,
  setHeaderColor,
  setTitle,
  tgg,
} from "./sdk";

export { createTggRuntime, getSupportedCapabilities, installTggRuntime } from "./core-runtime";

export { tgg as default } from "./sdk";

export type {
  MiniAppBridge,
  MiniAppCommunityInfo,
  MiniAppMethod,
  MiniAppNativeError,
  MiniAppRequest,
  MiniAppSDK,
  MiniAppSDKError,
  MiniAppSDKOptions,
  MiniAppSystemInfo,
  MiniAppUserInfo,
  TggBackButton,
  TggCapability,
  TggEventName,
  TggEventPayload,
  TggHeaderColor,
  TggRuntimeOptions,
  TggWebApp,
} from "./types";
