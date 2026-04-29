import { createBridgeClient } from "./bridge";
import { DEFAULT_BRIDGE_NAME } from "./constants";
import { getRuntimeGlobal } from "./runtime";
import type {
  MiniAppCommunityInfo,
  MiniAppSDK,
  MiniAppSDKOptions,
  MiniAppSystemInfo,
  MiniAppUserInfo,
} from "./types";

export const createMiniAppSDK = (options: MiniAppSDKOptions = {}): MiniAppSDK => {
  const bridgeName = options.bridgeName ?? DEFAULT_BRIDGE_NAME;
  const bridgeClient = createBridgeClient(bridgeName);

  return {
    bridgeName,
    resolve: (id, value) => bridgeClient.resolve(id, value),
    reject: (id, error) => bridgeClient.reject(id, error),
    getOauthCode: () => bridgeClient.invoke<string>("getOauthCode"),
    getUserId: () => bridgeClient.invoke<string>("getUserId"),
    getUserInfo: () => bridgeClient.invoke<MiniAppUserInfo>("getUserInfo"),
    getSystemInfo: () => bridgeClient.invoke<MiniAppSystemInfo>("getSystemInfo"),
    getCommunityId: () => bridgeClient.invoke<string>("getCommunityId"),
    getCommunityInfo: () => bridgeClient.invoke<MiniAppCommunityInfo>("getCommunityInfo"),
  };
};

export const TeamGagaMiniApp = createMiniAppSDK();

getRuntimeGlobal().TeamGagaMiniApp = TeamGagaMiniApp;

export const getOauthCode = (): Promise<string> => TeamGagaMiniApp.getOauthCode();

export const getUserId = (): Promise<string> => TeamGagaMiniApp.getUserId();

export const getUserInfo = (): Promise<MiniAppUserInfo> => TeamGagaMiniApp.getUserInfo();

export const getSystemInfo = (): Promise<MiniAppSystemInfo> => TeamGagaMiniApp.getSystemInfo();

export const getCommunityId = (): Promise<string> => TeamGagaMiniApp.getCommunityId();

export const getCommunityInfo = (): Promise<MiniAppCommunityInfo> =>
  TeamGagaMiniApp.getCommunityInfo();
