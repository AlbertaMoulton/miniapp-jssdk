export type MiniAppMethod =
  | "getOauthCode"
  | "getUserId"
  | "getUserInfo"
  | "getSystemInfo"
  | "getCommunityId"
  | "getCommunityInfo";

export type MiniAppBridge = {
  postMessage(message: string): void;
  [callbackId: string]: unknown;
};

export type MiniAppSDKOptions = {
  bridgeName?: string;
};

export type MiniAppRequest = {
  callback: string; // callback function unique id
  api: MiniAppMethod; // api name
  params?: Record<string, unknown>; // params of calling api
};

export type MiniAppNativeError = {
  code?: string;
  message?: string;
};

export type MiniAppNativeCallbackPayload = unknown;

export type MiniAppSDKError = Error & {
  code?: string;
};

export type MiniAppSDK = {
  readonly bridgeName: string;
  getOauthCode(): Promise<string>;
  getUserId(): Promise<string>;
  getUserInfo(): Promise<MiniAppUserInfo>;
  getSystemInfo(): Promise<MiniAppSystemInfo>;
  getCommunityId(): Promise<string>;
  getCommunityInfo(): Promise<MiniAppCommunityInfo>;
  resolve(id: string, value: unknown): void;
  reject(id: string, error: MiniAppNativeError | string): void;
};

type SystemLocale = {
  countryCode: string | number | null;
  languageCode: string;
};

type PhysicalSize = {
  width: number;
  height: number;
};

type PlatformBrightness = "light" | "dark";

type ViewPadding = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type MiniAppSystemInfo = {
  devicePixelRatio: number;
  textScaleFactor: number;
  locale: SystemLocale;
  physicalSize: PhysicalSize;
  platformBrightness: PlatformBrightness;
  viewPadding: ViewPadding;
};

export type MiniAppUserInfo = {
  userId: string;
  avatar: string;
  username: string;
  nickname: string;
};

export type MiniAppCommunityInfo = {
  communityId: string;
  name?: string;
  icon?: string;
};
