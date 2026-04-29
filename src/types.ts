export type MiniAppMethod =
  | "ready"
  | "setTitle"
  | "setHeaderColor"
  | "BackButton.show"
  | "BackButton.hide"
  | "getOauthCode"
  | "getUserId"
  | "getUserInfo"
  | "getSystemInfo"
  | "getCommunityId"
  | "getCommunityInfo";

export type TggHeaderColor = "bg_color" | "secondary_bg_color" | `#${string}`;

export type TggCapability = MiniAppMethod | "themeChanged" | "backButtonClicked";

export type TggEventName = "backButtonClicked";

export type TggEventPayload = undefined;

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
  ready(): Promise<void>;
  setTitle(title: string): Promise<void>;
  setHeaderColor(color: TggHeaderColor): Promise<void>;
  getOauthCode(): Promise<string>;
  getUserId(): Promise<string>;
  getUserInfo(): Promise<MiniAppUserInfo>;
  getSystemInfo(): Promise<MiniAppSystemInfo>;
  getCommunityId(): Promise<string>;
  getCommunityInfo(): Promise<MiniAppCommunityInfo>;
  BackButton: TggBackButton;
  resolve(id: string, value: unknown): void;
  reject(id: string, error: MiniAppNativeError | string): void;
  receiveEvent(eventName: TggEventName, payload?: unknown): void;
};

export type TggBackButton = {
  readonly isVisible: boolean;
  show(): Promise<void>;
  hide(): Promise<void>;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
};

export type TggWebApp = Omit<MiniAppSDK, "bridgeName"> & {
  readonly version: string;
  readonly sdkVersion: string;
  readonly platform: string;
  readonly appVersion: string;
  canIUse(capability: string): boolean;
};

export type TggRuntimeOptions = {
  appVersion?: string;
  bridgeName?: string;
  platform?: string;
  sdkVersion?: string;
  version?: string;
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
