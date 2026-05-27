import { createBridgeClient } from "./bridge";
import { SDK_NOT_INJECTED_MESSAGE, TGG_GLOBAL_NAME } from "./constants";
import { createMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  CapabilityConfig,
  ClipboardTextReceivedResult,
  CommunityInfo,
  DownloadFileCompleteResult,
  DownloadFileFailResult,
  DownloadFileOptions,
  DownloadFileSuccessResult,
  DownloadTask,
  DownloadTaskCallback,
  InitData,
  MiniAppMethod,
  MiniAppSDK,
  MiniAppSDKOptions,
  SavePhotoOptions,
  SaveVideoOptions,
  SystemInfo,
  UserInfo,
  TggEventName,
  TggHeaderColor,
  TggWebApp,
} from "./types";

const BACK_BUTTON_CLICKED_EVENT: TggEventName = "back_button_clicked";
const CLIPBOARD_TEXT_RECEIVED_EVENT: TggEventName = "clipboard_text_received";
const DOWNLOAD_ABORT_MESSAGE = "downloadFile:abort";
const DOWNLOAD_OK_MESSAGE = "downloadFile:ok";
const DOWNLOAD_URL_ERROR_MESSAGE = "downloadFile:fail invalid url";
const BACK_BUTTON_HANDLER_ERROR_MESSAGE = "[Teamgaga] BackButton.onClick handler failed";
const INVALID_HEADER_COLOR_CODE = "INVALID_HEADER_COLOR";
const UNSUPPORTED_CAPABILITY_CODE = "UNSUPPORTED_CAPABILITY";

const eventReceivers = new WeakMap<
  MiniAppSDK,
  (eventName: TggEventName, payload?: unknown) => void
>();
const eventHandlerCheckers = new WeakMap<MiniAppSDK, (eventName: string) => boolean>();

export const DEFAULT_CAPABILITIES: readonly CapabilityConfig[] = [
  { name: "init" },
  { name: "ready" },
  { name: "close" },
  { name: "setHeaderColor" },
  { name: "BackButton.show" },
  { name: "BackButton.hide" },
  { name: "getOauthCode" },
  { name: "getUserId" },
  { name: "getUserInfo" },
  { name: "getSystemInfo" },
  { name: "getCommunityId" },
  { name: "getCommunityInfo" },
  { name: "downloadFile" },
  { name: "abortDownloadFile" },
  { name: "savePhoto" },
  { name: "saveVideo" },
  { name: "readTextFromClipboard" },
  { name: "activated" },
  { name: "deactivated" },
  { name: "theme_changed" },
  { name: "back_button_clicked" },
  { name: "viewport_changed" },
  { name: "safe_area_changed" },
  { name: "content_safe_area_changed" },
  { name: "fullscreen_changed" },
  { name: "fullscreen_failed" },
  { name: "download_file_progress" },
  { name: "download_file_success" },
  { name: "download_file_fail" },
  { name: "clipboard_text_received" },
];

export const NATIVE_METHOD_CAPABILITIES: readonly MiniAppMethod[] = [
  "init",
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
  "downloadFile",
  "abortDownloadFile",
  "savePhoto",
  "saveVideo",
  "readTextFromClipboard",
];

type DownloadTaskState = {
  options: DownloadFileOptions;
  progressHandlers: Set<DownloadTaskCallback>;
  settled: boolean;
};

export const createMiniAppSDK = (options: MiniAppSDKOptions = {}): MiniAppSDK => {
  const bridgeClient = createBridgeClient({
    handlerName: options.handlerName,
    sdkVersion: options.sdkVersion,
  });
  let appVersion = options.appVersion ?? "";
  const capabilities = new Map<string, CapabilityConfig>(
    [...DEFAULT_CAPABILITIES, ...(options.capabilities ?? [])].map((capability) => [
      capability.name,
      capability,
    ]),
  );
  let backButtonVisible = false;
  let backButtonDesiredVisible = false;
  let backButtonSyncPromise: Promise<void> | undefined;
  const eventHandlers = new Map<TggEventName, Set<(payload?: unknown) => void>>();
  const downloadTasks = new Map<string, DownloadTaskState>();
  let downloadTaskSequence = 0;

  const isVersionAtLeast = (version: string): boolean => compareVersions(appVersion, version) >= 0;

  const canIUse = (capabilityName: string): boolean => {
    const capability = capabilities.get(capabilityName);

    if (!capability || capability.enabled === false) {
      return false;
    }

    if (capability.minAppVersion && !isVersionAtLeast(capability.minAppVersion)) {
      return false;
    }

    return true;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    if (!canIUse(method)) {
      return Promise.reject(
        createMiniAppError(`Unsupported capability: ${method}`, UNSUPPORTED_CAPABILITY_CODE),
      );
    }

    return bridgeClient.invoke<T>(method, params);
  };

  const onEvent = (eventName: TggEventName, callback: (payload?: unknown) => void): void => {
    const handlers = eventHandlers.get(eventName) ?? new Set<(payload?: unknown) => void>();
    handlers.add(callback);
    eventHandlers.set(eventName, handlers);
  };

  const offEvent = (eventName: TggEventName, callback: (payload?: unknown) => void): void => {
    eventHandlers.get(eventName)?.delete(callback);
  };

  const hasEventHandlers = (eventName: string): boolean => {
    return (eventHandlers.get(eventName as TggEventName)?.size ?? 0) > 0;
  };

  const receiveEvent = (eventName: TggEventName, payload?: unknown): void => {
    if (eventName === "download_file_progress") {
      receiveDownloadFileProgress(payload);
      return;
    }

    if (eventName === "download_file_success") {
      receiveDownloadFileSuccess(payload);
      return;
    }

    if (eventName === "download_file_fail") {
      receiveDownloadFileFail(payload);
      return;
    }

    if (eventName === "clipboard_text_received") {
      emitEvent(eventName, getClipboardTextReceivedResult(payload));
      return;
    }

    emitEvent(eventName, payload);
  };

  const emitEvent = (eventName: TggEventName, payload?: unknown): void => {
    const handlers = Array.from(eventHandlers.get(eventName) ?? []);
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(BACK_BUTTON_HANDLER_ERROR_MESSAGE, error);
      }
    });
  };

  const setHeaderColor = (color: TggHeaderColor): Promise<void> => {
    if (!isHeaderColor(color)) {
      return Promise.reject(
        createMiniAppError(`Invalid header color: ${String(color)}`, INVALID_HEADER_COLOR_CODE),
      );
    }

    return invoke<void>("setHeaderColor", { color });
  };

  const syncBackButtonVisibility = async (): Promise<void> => {
    while (backButtonVisible !== backButtonDesiredVisible) {
      const nextVisible = backButtonDesiredVisible;
      await invoke<void>(nextVisible ? "BackButton.show" : "BackButton.hide");
      backButtonVisible = nextVisible;
    }
  };

  const setBackButtonVisible = (visible: boolean): Promise<void> => {
    backButtonDesiredVisible = visible;

    if (backButtonVisible === visible && !backButtonSyncPromise) {
      return Promise.resolve();
    }

    if (!backButtonSyncPromise) {
      backButtonSyncPromise = syncBackButtonVisibility().finally(() => {
        backButtonSyncPromise = undefined;
      });
    }

    return backButtonSyncPromise;
  };

  const init = async (): Promise<InitData> => {
    const initData = await invoke<InitData>("init");
    appVersion = initData.appVersion;
    return initData;
  };

  const createDownloadTaskId = (): string => {
    downloadTaskSequence += 1;
    return `tgg_download_${downloadTaskSequence}`;
  };

  const downloadFile = (options: DownloadFileOptions): DownloadTask => {
    const taskId = createDownloadTaskId();
    const progressHandlers = new Set<DownloadTaskCallback>();
    const taskState: DownloadTaskState = {
      options,
      progressHandlers,
      settled: false,
    };

    const task = createDownloadTask(taskId, taskState);
    const validationError = getDownloadFileValidationError(options);
    if (validationError) {
      settleDownloadFileFail(taskState, validationError);
      return task;
    }

    downloadTasks.set(taskId, taskState);
    void invoke<void>("downloadFile", {
      taskId,
      url: options.url,
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "downloadFile:fail";
      const state = downloadTasks.get(taskId);
      if (state) {
        settleDownloadFileFail(state, message);
        downloadTasks.delete(taskId);
      }
    });

    return task;
  };

  const createDownloadTask = (taskId: string, taskState: DownloadTaskState): DownloadTask => ({
    abort() {
      if (taskState.settled) {
        return;
      }

      void invoke<void>("abortDownloadFile", { taskId }).catch(() => {});
      settleDownloadFileFail(taskState, DOWNLOAD_ABORT_MESSAGE);
      downloadTasks.delete(taskId);
    },
    onProgressUpdate(callback: DownloadTaskCallback) {
      taskState.progressHandlers.add(callback);
    },
    offProgressUpdate(callback: DownloadTaskCallback) {
      taskState.progressHandlers.delete(callback);
    },
  });

  const readTextFromClipboard = async (): Promise<ClipboardTextReceivedResult> => {
    const result = getClipboardTextReceivedResult(
      await invoke<ClipboardTextReceivedResult>("readTextFromClipboard"),
    );
    emitEvent(CLIPBOARD_TEXT_RECEIVED_EVENT, result);
    return result;
  };

  const receiveDownloadFileProgress = (payload: unknown): void => {
    const taskId = getStringValue(payload, "taskId");
    const progress = getNumberValue(payload, "progress");

    if (!taskId || typeof progress !== "number") {
      return;
    }

    const taskState = downloadTasks.get(taskId);
    if (!taskState || taskState.settled) {
      return;
    }

    Array.from(taskState.progressHandlers).forEach((handler) => {
      handler({ progress });
    });
  };

  const receiveDownloadFileSuccess = (payload: unknown): void => {
    const taskId = getStringValue(payload, "taskId");
    const tempFilePath = getStringValue(payload, "tempFilePath");

    if (!taskId || !tempFilePath) {
      return;
    }

    const taskState = downloadTasks.get(taskId);
    if (!taskState) {
      return;
    }

    settleDownloadFileSuccess(taskState, { tempFilePath });
    downloadTasks.delete(taskId);
  };

  const receiveDownloadFileFail = (payload: unknown): void => {
    const taskId = getStringValue(payload, "taskId");
    const errMsg = getStringValue(payload, "errMsg") ?? "downloadFile:fail";

    if (!taskId) {
      return;
    }

    const taskState = downloadTasks.get(taskId);
    if (!taskState) {
      return;
    }

    settleDownloadFileFail(taskState, errMsg);
    downloadTasks.delete(taskId);
  };

  const sdk: MiniAppSDK = {
    canIUse,
    isVersionAtLeast,
    onEvent,
    offEvent,
    init,
    ready: () => invoke<void>("ready"),
    close: () => invoke<void>("close"),
    setHeaderColor,
    getOauthCode: () => invoke<string>("getOauthCode"),
    getUserId: () => invoke<string>("getUserId"),
    getUserInfo: () => invoke<UserInfo>("getUserInfo"),
    getSystemInfo: () => invoke<SystemInfo>("getSystemInfo"),
    getCommunityId: () => invoke<string>("getCommunityId"),
    getCommunityInfo: () => invoke<CommunityInfo>("getCommunityInfo"),
    downloadFile,
    savePhoto: (options: SavePhotoOptions) => invoke<boolean>("savePhoto", options),
    saveVideo: (options: SaveVideoOptions) => invoke<boolean>("saveVideo", options),
    readTextFromClipboard,
    BackButton: {
      get isVisible() {
        return backButtonVisible;
      },
      show: () => setBackButtonVisible(true),
      hide: () => setBackButtonVisible(false),
      onClick(cb: () => void) {
        onEvent(BACK_BUTTON_CLICKED_EVENT, cb);
      },
      offClick(cb: () => void) {
        offEvent(BACK_BUTTON_CLICKED_EVENT, cb);
      },
    },
  };

  eventReceivers.set(sdk, receiveEvent);
  eventHandlerCheckers.set(sdk, hasEventHandlers);
  return sdk;
};

export const receiveMiniAppSDKEvent = (
  sdk: MiniAppSDK,
  eventName: TggEventName,
  payload?: unknown,
): void => {
  eventReceivers.get(sdk)?.(eventName, payload);
};

export const hasMiniAppSDKEventHandlers = (sdk: MiniAppSDK, eventName: string): boolean => {
  return eventHandlerCheckers.get(sdk)?.(eventName) ?? false;
};

const settleDownloadFileSuccess = (
  taskState: DownloadTaskState,
  result: DownloadFileSuccessResult,
): void => {
  if (taskState.settled) {
    return;
  }

  taskState.settled = true;
  taskState.options.success?.(result);
  taskState.options.complete?.({ errMsg: DOWNLOAD_OK_MESSAGE });
};

const settleDownloadFileFail = (taskState: DownloadTaskState, errMsg: string): void => {
  if (taskState.settled) {
    return;
  }

  const result: DownloadFileFailResult & DownloadFileCompleteResult = { errMsg };
  taskState.settled = true;
  taskState.options.fail?.(result);
  taskState.options.complete?.(result);
};

const getClipboardTextReceivedResult = (payload: unknown): ClipboardTextReceivedResult => {
  return {
    data: getStringValue(payload, "data") ?? null,
  };
};

const getDownloadFileValidationError = (options: DownloadFileOptions): string | undefined => {
  if (!isHttpUrl(options.url)) {
    return DOWNLOAD_URL_ERROR_MESSAGE;
  }

  return undefined;
};

const isHttpUrl = (value: string): boolean => {
  return /^https?:\/\/\S+$/i.test(value);
};

const getStringValue = (payload: unknown, key: string): string | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "string" ? value : undefined;
};

const getNumberValue = (payload: unknown, key: string): number | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "number" ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const compareVersions = (currentVersion: string, requiredVersion: string): number => {
  const currentParts = parseVersion(currentVersion);
  const requiredParts = parseVersion(requiredVersion);
  const length = Math.max(currentParts.length, requiredParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const requiredPart = requiredParts[index] ?? 0;

    if (currentPart > requiredPart) {
      return 1;
    }

    if (currentPart < requiredPart) {
      return -1;
    }
  }

  return 0;
};

const parseVersion = (version: string): number[] =>
  version
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

const isHeaderColor = (color: string): color is TggHeaderColor =>
  color === "bg_color" || color === "secondary_bg_color" || /^#[0-9a-f]{6}$/i.test(color);

export const getTgg = (): TggWebApp => {
  const runtime = getRuntimeGlobal()[TGG_GLOBAL_NAME] as TggWebApp | undefined;

  if (!runtime) {
    throw new Error(SDK_NOT_INJECTED_MESSAGE);
  }

  return runtime;
};

export const tgg = new Proxy({} as TggWebApp, {
  get(_, property) {
    return getTgg()[property as keyof TggWebApp];
  },
  set(_, property, value) {
    (getTgg() as unknown as Record<PropertyKey, unknown>)[property] = value;
    return true;
  },
});

export const TeamGagaMiniApp = tgg;

export const getOauthCode = (): Promise<string> => getTgg().getOauthCode();

export const getUserId = (): Promise<string> => getTgg().getUserId();

export const getUserInfo = (): Promise<UserInfo> => getTgg().getUserInfo();

export const getSystemInfo = (): Promise<SystemInfo> => getTgg().getSystemInfo();

export const getCommunityId = (): Promise<string> => getTgg().getCommunityId();

export const getCommunityInfo = (): Promise<CommunityInfo> => getTgg().getCommunityInfo();

export const setHeaderColor = (color: TggHeaderColor): Promise<void> =>
  getTgg().setHeaderColor(color);

export const readTextFromClipboard = (): Promise<ClipboardTextReceivedResult> =>
  getTgg().readTextFromClipboard();
