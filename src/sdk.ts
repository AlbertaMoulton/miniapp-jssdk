import { createBridgeClient } from "./bridge";
import { DEFAULT_BRIDGE_NAME, SDK_NOT_INJECTED_MESSAGE, TGG_GLOBAL_NAME } from "./constants";
import { getRuntimeGlobal } from "./runtime";
import type {
  MiniAppCommunityInfo,
  MiniAppSDK,
  MiniAppSDKOptions,
  MiniAppSystemInfo,
  MiniAppUserInfo,
  TggHeaderColor,
  TggWebApp,
} from "./types";

export const createMiniAppSDK = (options: MiniAppSDKOptions = {}): MiniAppSDK => {
  const bridgeName = options.bridgeName ?? DEFAULT_BRIDGE_NAME;
  const bridgeClient = createBridgeClient(bridgeName);
  let backButtonVisible = false;

  return {
    bridgeName,
    resolve: (id, value) => bridgeClient.resolve(id, value),
    reject: (id, error) => bridgeClient.reject(id, error),
    ready: () => bridgeClient.invoke<void>("ready"),
    setTitle: (title) => bridgeClient.invoke<void>("setTitle", { title }),
    setHeaderColor: (color) => bridgeClient.invoke<void>("setHeaderColor", { color }),
    getOauthCode: () => bridgeClient.invoke<string>("getOauthCode"),
    getUserId: () => bridgeClient.invoke<string>("getUserId"),
    getUserInfo: () => bridgeClient.invoke<MiniAppUserInfo>("getUserInfo"),
    getSystemInfo: () => bridgeClient.invoke<MiniAppSystemInfo>("getSystemInfo"),
    getCommunityId: () => bridgeClient.invoke<string>("getCommunityId"),
    getCommunityInfo: () => bridgeClient.invoke<MiniAppCommunityInfo>("getCommunityInfo"),
    BackButton: {
      get isVisible() {
        return backButtonVisible;
      },
      async show() {
        await bridgeClient.invoke<void>("BackButton.show");
        backButtonVisible = true;
      },
      async hide() {
        await bridgeClient.invoke<void>("BackButton.hide");
        backButtonVisible = false;
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

export const setTitle = (title: string): Promise<void> => getTgg().setTitle(title);

export const setHeaderColor = (color: TggHeaderColor): Promise<void> =>
  getTgg().setHeaderColor(color);
