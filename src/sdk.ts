import { createBridgeClient } from "./bridge";
import { SDK_NOT_INJECTED_MESSAGE, TGG_GLOBAL_NAME } from "./constants";
import { createMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  MiniAppCapabilityDefinition,
  MiniAppCommunityInfo,
  MiniAppMethod,
  MiniAppSDK,
  MiniAppSDKOptions,
  MiniAppSystemInfo,
  MiniAppUserInfo,
  TggEventName,
  TggHeaderColor,
  TggWebApp,
} from "./types";

const BACK_BUTTON_CLICKED_EVENT: TggEventName = "backButtonClicked";
const BACK_BUTTON_HANDLER_ERROR_MESSAGE = "[Teamgaga] BackButton.onClick handler failed";
const PERMISSION_DENIED_CODE = "PERMISSION_DENIED";

export const DEFAULT_CAPABILITIES: readonly MiniAppCapabilityDefinition[] = [
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
  const capabilities = new Map<string, MiniAppCapabilityDefinition>(
    [...DEFAULT_CAPABILITIES, ...(options.capabilities ?? [])].map((capability) => [
      capability.name,
      capability,
    ]),
  );
  let backButtonVisible = false;
  const backButtonClickHandlers = new Set<() => void>();

  const canIUse = (capabilityName: string): boolean => {
    const capability = capabilities.get(capabilityName);

    if (!capability || capability.enabled === false) {
      return false;
    }

    if (capability.permission && !permissions.has(capability.permission)) {
      return false;
    }

    return true;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    if (!canIUse(method)) {
      return Promise.reject(
        createMiniAppError(
          `Permission denied or unsupported capability: ${method}`,
          PERMISSION_DENIED_CODE,
        ),
      );
    }

    return bridgeClient.invoke<T>(method, params);
  };

  const emitBackButtonClicked = (): void => {
    const handlers = Array.from(backButtonClickHandlers);
    handlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error(BACK_BUTTON_HANDLER_ERROR_MESSAGE, error);
      }
    });
  };

  return {
    invoke,
    canIUse,
    ready: () => invoke<void>("ready"),
    close: () => invoke<void>("close"),
    setHeaderColor: (color) => invoke<void>("setHeaderColor", { color }),
    getOauthCode: () => invoke<string>("getOauthCode"),
    getUserId: () => invoke<string>("getUserId"),
    getUserInfo: () => invoke<MiniAppUserInfo>("getUserInfo"),
    getSystemInfo: () => invoke<MiniAppSystemInfo>("getSystemInfo"),
    getCommunityId: () => invoke<string>("getCommunityId"),
    getCommunityInfo: () => invoke<MiniAppCommunityInfo>("getCommunityInfo"),
    receiveEvent: (eventName: TggEventName, _payload?: unknown) => {
      if (eventName === BACK_BUTTON_CLICKED_EVENT) {
        emitBackButtonClicked();
      }
    },
    BackButton: {
      get isVisible() {
        return backButtonVisible;
      },
      async show() {
        await invoke<void>("BackButton.show");
        backButtonVisible = true;
      },
      async hide() {
        await invoke<void>("BackButton.hide");
        backButtonVisible = false;
      },
      onClick(cb: () => void) {
        backButtonClickHandlers.add(cb);
      },
      offClick(cb: () => void) {
        backButtonClickHandlers.delete(cb);
      },
    },
  };
};

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

export const getUserInfo = (): Promise<MiniAppUserInfo> => getTgg().getUserInfo();

export const getSystemInfo = (): Promise<MiniAppSystemInfo> => getTgg().getSystemInfo();

export const getCommunityId = (): Promise<string> => getTgg().getCommunityId();

export const getCommunityInfo = (): Promise<MiniAppCommunityInfo> => getTgg().getCommunityInfo();

export const setHeaderColor = (color: TggHeaderColor): Promise<void> =>
  getTgg().setHeaderColor(color);
