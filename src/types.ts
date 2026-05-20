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
  | "getCommunityInfo"
  | "downloadFile"
  | "abortDownloadFile"
  | "saveImageToAlbum";

export type TggHeaderColor = "bg_color" | "secondary_bg_color" | `#${string}`;

export type TggColorScheme = "light" | "dark";

export type TggCapability =
  | MiniAppMethod
  | "themeChanged"
  | "backButtonClicked"
  | "viewportChanged"
  | "safeAreaChanged"
  | "contentSafeAreaChanged"
  | "fullscreenChanged"
  | "downloadFileProgress"
  | "downloadFileSuccess"
  | "downloadFileFail"
  | "clipboardTextReceived";

export type TggEventName =
  | "backButtonClicked"
  | "themeChanged"
  | "viewportChanged"
  | "safeAreaChanged"
  | "contentSafeAreaChanged"
  | "fullscreenChanged"
  | "downloadFileProgress"
  | "downloadFileSuccess"
  | "downloadFileFail"
  | "clipboardTextReceived";

export type TggEventPayload = unknown;

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

export type WebViewFlutterJavaScriptChannel = {
  postMessage(message: string): void;
};

export type BridgeTransport = {
  send<T>(request: MiniAppInvokeRequest): Promise<T>;
};

export type CapabilityConfig = {
  name: TggCapability;
  minAppVersion?: string;
  enabled?: boolean;
};

export type MiniAppSDKOptions = {
  appVersion?: string;
  handlerName?: string;
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
  themeParams?: ThemeParams;
  viewportHeight?: number;
  viewportStableHeight?: number;
  headerColor?: string;
  backgroundColor?: string;
  isFullscreen?: boolean;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  launchContext?: LaunchContext;
};

export type DownloadFileSuccessResult = {
  tempFilePath: string;
};

export type DownloadFileFailResult = {
  errMsg: string;
};

export type DownloadFileCompleteResult = {
  errMsg: string;
};

export type DownloadProgress = {
  progress: number;
};

export type DownloadTaskCallback = (res: DownloadProgress) => void;

export type DownloadFileOptions = {
  url: string;
  fileName?: string;
  success?(res: DownloadFileSuccessResult): void;
  fail?(res: DownloadFileFailResult): void;
  complete?(res: DownloadFileCompleteResult): void;
};

export type DownloadTask = {
  abort(): void;
  onProgressUpdate(callback: DownloadTaskCallback): void;
  offProgressUpdate(callback: DownloadTaskCallback): void;
};

export type SaveImageToAlbumOptions = {
  fileName?: string;
  dataUrl: string;
};

export type ClipboardTextReceivedResult = {
  data: string | null;
};

export type ClipboardTextReceivedCallback = (res: ClipboardTextReceivedResult) => void;

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
  downloadFile(options: DownloadFileOptions): DownloadTask;
  saveImageToAlbum(options: SaveImageToAlbumOptions): Promise<boolean>;
  onClipboardTextReceived(callback: ClipboardTextReceivedCallback): () => void;
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
  readonly themeParams: ThemeParams;
  readonly viewportHeight: number;
  readonly viewportStableHeight: number;
  readonly headerColor: string;
  readonly backgroundColor: string;
  readonly isFullscreen: boolean;
  readonly safeAreaInset: SafeAreaInset;
  readonly contentSafeAreaInset: SafeAreaInset;
};

export type TggRuntimeOptions = MiniAppSDKOptions & {
  appVersion?: string;
  colorScheme?: TggColorScheme;
  platform?: string;
  version?: string;
  themeParams?: ThemeParams;
  viewportHeight?: number;
  viewportStableHeight?: number;
  headerColor?: string;
  backgroundColor?: string;
  isFullscreen?: boolean;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
};

export type ThemeParams = Record<string, string>;

export type SafeAreaInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
    nativeBridge?: WebViewFlutterJavaScriptChannel;
    tgg?: TggWebApp;
    __tgg_emit?: (eventName: string, payload?: unknown) => void;
    __tgg_resolve?: (id: string, envelope: MiniAppInvokeResponse | unknown) => void;
  }
}
