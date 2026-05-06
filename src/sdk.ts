import { createBridgeClient } from "./bridge";
import { SDK_NOT_INJECTED_MESSAGE, TGG_GLOBAL_NAME } from "./constants";
import { createMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  CapabilityConfig,
  CommunityInfo,
  MiniAppMethod,
  MiniAppSDK,
  MiniAppSDKOptions,
  SystemInfo,
  UserInfo,
  TggEventName,
  TggHeaderColor,
  TggWebApp,
} from "./types";

const BACK_BUTTON_CLICKED_EVENT: TggEventName = "backButtonClicked";
const BACK_BUTTON_HANDLER_ERROR_MESSAGE = "[Teamgaga] BackButton.onClick handler failed";
const INVALID_HEADER_COLOR_CODE = "INVALID_HEADER_COLOR";
const PERMISSION_DENIED_CODE = "PERMISSION_DENIED";
const UNSUPPORTED_CAPABILITY_CODE = "UNSUPPORTED_CAPABILITY";

export const DEFAULT_CAPABILITIES: readonly CapabilityConfig[] = [
  { name: "ready" },
  { name: "close" },
  { name: "setHeaderColor" },
  { name: "BackButton.show" },
  { name: "BackButton.hide" },
  { name: "getOauthCode", permission: "user:read" },
  { name: "getUserId", permission: "user:read" },
  { name: "getUserInfo", permission: "user:read" },
  { name: "getSystemInfo", permission: "system:read" },
  { name: "getCommunityId", permission: "community:read" },
  { name: "getCommunityInfo", permission: "community:read" },
  { name: "themeChanged" },
  { name: "backButtonClicked" },
];

export const NATIVE_METHOD_CAPABILITIES: readonly MiniAppMethod[] = [
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
];

export const createMiniAppSDK = (options: MiniAppSDKOptions = {}): MiniAppSDK => {
  const bridgeClient = createBridgeClient({
    handlerName: options.handlerName,
    sdkVersion: options.sdkVersion,
  });
  const permissions = new Set(options.permissions ?? []);
  const appVersion = options.appVersion ?? "";
  const capabilities = new Map<string, CapabilityConfig>(
    [...DEFAULT_CAPABILITIES, ...(options.capabilities ?? [])].map((capability) => [
      capability.name,
      capability,
    ]),
  );
  let backButtonVisible = false;
  const eventHandlers = new Map<TggEventName, Set<(payload?: unknown) => void>>();

  const isVersionAtLeast = (version: string): boolean => compareVersions(appVersion, version) >= 0;

  const canIUse = (capabilityName: string): boolean => {
    const capability = capabilities.get(capabilityName);

    if (!capability || capability.enabled === false) {
      return false;
    }

    if (capability.minAppVersion && !isVersionAtLeast(capability.minAppVersion)) {
      return false;
    }

    if (capability.permission && !permissions.has(capability.permission)) {
      return false;
    }

    return true;
  };

  const getCapabilityFailureCode = (method: MiniAppMethod): string => {
    const capability = capabilities.get(method);

    if (capability?.permission && !permissions.has(capability.permission)) {
      return PERMISSION_DENIED_CODE;
    }

    return UNSUPPORTED_CAPABILITY_CODE;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    if (!canIUse(method)) {
      return Promise.reject(
        createMiniAppError(
          `Permission denied or unsupported capability: ${method}`,
          getCapabilityFailureCode(method),
        ),
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

  const receiveEvent = (eventName: TggEventName, payload?: unknown): void => {
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

  return {
    invoke,
    canIUse,
    isVersionAtLeast,
    onEvent,
    offEvent,
    ready: () => invoke<void>("ready"),
    close: () => invoke<void>("close"),
    setHeaderColor,
    getOauthCode: () => invoke<string>("getOauthCode"),
    getUserId: () => invoke<string>("getUserId"),
    getUserInfo: () => invoke<UserInfo>("getUserInfo"),
    getSystemInfo: () => invoke<SystemInfo>("getSystemInfo"),
    getCommunityId: () => invoke<string>("getCommunityId"),
    getCommunityInfo: () => invoke<CommunityInfo>("getCommunityInfo"),
    receiveEvent,
    BackButton: {
      get isVisible() {
        return backButtonVisible;
      },
      async show() {
        if (backButtonVisible) {
          return;
        }

        await invoke<void>("BackButton.show");
        backButtonVisible = true;
      },
      async hide() {
        if (!backButtonVisible) {
          return;
        }

        await invoke<void>("BackButton.hide");
        backButtonVisible = false;
      },
      onClick(cb: () => void) {
        onEvent(BACK_BUTTON_CLICKED_EVENT, cb);
      },
      offClick(cb: () => void) {
        offEvent(BACK_BUTTON_CLICKED_EVENT, cb);
      },
    },
  };
};

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
