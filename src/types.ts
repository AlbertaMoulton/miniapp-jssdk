export type MiniAppMethod =
  | "init"
  | "ready"
  | "close"
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

export type TggColorScheme = "light" | "dark";

export type TggCapability = MiniAppMethod | "themeChanged" | "backButtonClicked";

export type TggEventName = "backButtonClicked" | "themeChanged";

export type TggEventPayload = unknown;

export type MiniAppPermission = "user:read" | "system:read" | "community:read";

export type MiniAppInvokeRequest = {
  id: string;
  method: MiniAppMethod;
  params?: Record<string, unknown>;
  sdkVersion: string;
  timestamp: number;
};

export type MiniAppNativeError = {
  code?: string;
  message?: string;
};

export type MiniAppInvokeSuccessResponse<T = unknown> = {
  success: true;
  data?: T;
};

export type MiniAppInvokeFailureResponse = {
  success: false;
  error?: MiniAppNativeError;
  code?: string;
  message?: string;
};

export type MiniAppInvokeResponse<T = unknown> =
  | MiniAppInvokeSuccessResponse<T>
  | MiniAppInvokeFailureResponse;

export type FlutterInAppWebViewBridge = {
  callHandler(handlerName: string, payload: unknown): Promise<unknown>;
};

export type BridgeTransport = {
  send<T>(request: MiniAppInvokeRequest): Promise<T>;
};

export type CapabilityConfig = {
  name: TggCapability;
  permission?: MiniAppPermission;
  minAppVersion?: string;
  enabled?: boolean;
};

export type MiniAppSDKOptions = {
  appVersion?: string;
  handlerName?: string;
  permissions?: readonly MiniAppPermission[];
  sdkVersion?: string;
  capabilities?: readonly CapabilityConfig[];
};

export type MiniAppSDKError = Error & {
  code?: string;
};

export type LaunchContext = Record<string, unknown>;

export type InitData = {
  appVersion: string;
  sdkVersion: string;
  colorScheme: TggColorScheme;
  platform: string;
  launchContext?: LaunchContext;
};

export type MiniAppSDK = {
  invoke<T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T>;
  canIUse(capability: string): boolean;
  isVersionAtLeast(version: string): boolean;
  onEvent(eventName: TggEventName, callback: (payload?: unknown) => void): void;
  offEvent(eventName: TggEventName, callback: (payload?: unknown) => void): void;
  init(): Promise<InitData>;
  ready(): Promise<void>;
  close(): Promise<void>;
  setHeaderColor(color: TggHeaderColor): Promise<void>;
  getOauthCode(): Promise<string>;
  getUserId(): Promise<string>;
  getUserInfo(): Promise<UserInfo>;
  getSystemInfo(): Promise<SystemInfo>;
  getCommunityId(): Promise<string>;
  getCommunityInfo(): Promise<CommunityInfo>;
  BackButton: TggBackButton;
  receiveEvent(eventName: TggEventName, payload?: unknown): void;
};

export type TggBackButton = {
  readonly isVisible: boolean;
  show(): Promise<void>;
  hide(): Promise<void>;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
};

export type TggWebApp = MiniAppSDK & {
  readonly version: string;
  readonly sdkVersion: string;
  readonly platform: string;
  readonly appVersion: string;
  readonly colorScheme: TggColorScheme;
};

export type TggRuntimeOptions = MiniAppSDKOptions & {
  appVersion?: string;
  colorScheme?: TggColorScheme;
  platform?: string;
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

export type SystemInfo = {
  devicePixelRatio: number;
  textScaleFactor: number;
  locale: SystemLocale;
  physicalSize: PhysicalSize;
  platformBrightness: PlatformBrightness;
  viewPadding: ViewPadding;
};

export type UserInfo = {
  userId: string;
  avatar: string;
  username: string;
  nickname: string;
};

export type CommunityInfo = {
  communityId: string;
  name?: string;
  icon?: string;
};

declare global {
  interface Window {
    flutter_inappwebview?: FlutterInAppWebViewBridge;
    tgg?: TggWebApp;
    __tgg_emit?: (eventName: string, payload?: unknown) => void;
  }
}
