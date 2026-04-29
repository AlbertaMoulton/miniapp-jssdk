export {
  TeamGagaMiniApp,
  createMiniAppSDK,
  getCommunityId,
  getCommunityInfo,
  getOauthCode,
  getSystemInfo,
  getUserId,
  getUserInfo,
} from "./sdk";

export { TeamGagaMiniApp as default } from "./sdk";

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
} from "./types";
