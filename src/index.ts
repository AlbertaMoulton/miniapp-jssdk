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
  tgg,
} from "./sdk";

export { createTggRuntime, getSupportedCapabilities, installTggRuntime } from "./core-runtime";

export { tgg as default } from "./sdk";

export type {
  BridgeTransport,
  FlutterInAppWebViewBridge,
  MiniAppCapabilityDefinition,
  MiniAppCommunityInfo,
  MiniAppInvokeRequest,
  MiniAppInvokeResponse,
  MiniAppMethod,
  MiniAppNativeError,
  MiniAppPermission,
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
