import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import {
  default as defaultMiniAppSDK,
  createMiniAppSDK,
  getCommunityInfo,
  getCommunityId,
  getOauthCode,
  getSystemInfo,
  TeamGagaMiniApp,
  getUserId,
  getUserInfo,
} from "../src/index";

type TestGlobal = typeof globalThis & Record<string, unknown>;
type TestBridge = {
  postMessage(message: string): void;
  [callbackId: string]: unknown;
};

const testGlobal = globalThis as TestGlobal;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete testGlobal.tgg;
});

test("calls the Flutter WebView bridge with callback id and api name", async () => {
  const messages: unknown[] = [];
  testGlobal.tgg = {
    postMessage(message: string) {
      messages.push(JSON.parse(message));
    },
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserId();

  expect(messages).toEqual([
    {
      callback: "tgg_cb_1",
      api: "getUserId",
    },
  ]);

  sdk.resolve("tgg_cb_1", "user-123");

  await expect(promise).resolves.toBe("user-123");
});

test("registers a callback on the tgg bridge for native responses", async () => {
  testGlobal.tgg = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.tgg as TestBridge;

  expect(bridge.tgg_cb_1).toEqual(expect.any(Function));

  (bridge.tgg_cb_1 as (value: unknown) => void)({
    userId: "user-123",
    avatar: "https://example.com/avatar.png",
    username: "alice",
    nickname: "Alice",
  });

  await expect(promise).resolves.toEqual({
    userId: "user-123",
    avatar: "https://example.com/avatar.png",
    username: "alice",
    nickname: "Alice",
  });
  expect(bridge.tgg_cb_1).toBeUndefined();
});

test("bridge callbacks can reject native errors", async () => {
  testGlobal.tgg = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.tgg as TestBridge;

  (bridge.tgg_cb_1 as (value: unknown) => void)({
    code: "USER_UNAVAILABLE",
    message: "User is unavailable",
    success: false,
  });

  await expect(promise).rejects.toMatchObject({
    code: "USER_UNAVAILABLE",
    message: "User is unavailable",
  });
  expect(bridge.tgg_cb_1).toBeUndefined();
});

test("bridge callbacks parse JSON string responses", async () => {
  testGlobal.tgg = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.tgg as TestBridge;

  (bridge.tgg_cb_1 as (value: unknown) => void)(
    JSON.stringify({
      userId: "user-123",
      avatar: "https://example.com/avatar.png",
      username: "alice",
      nickname: "Alice",
    }),
  );

  await expect(promise).resolves.toEqual({
    userId: "user-123",
    avatar: "https://example.com/avatar.png",
    username: "alice",
    nickname: "Alice",
  });
  expect(bridge.tgg_cb_1).toBeUndefined();
});

test("exposes all known miniapp API methods", () => {
  expect(getOauthCode).toEqual(expect.any(Function));
  expect(getUserId).toEqual(expect.any(Function));
  expect(getUserInfo).toEqual(expect.any(Function));
  expect(getSystemInfo).toEqual(expect.any(Function));
  expect(getCommunityId).toEqual(expect.any(Function));
  expect(getCommunityInfo).toEqual(expect.any(Function));
});

test("supports default imports for app bundlers", async () => {
  expect(defaultMiniAppSDK).toBe(TeamGagaMiniApp);
  await expect(defaultMiniAppSDK.getSystemInfo()).rejects.toThrow(
    "TeamGaga miniapp bridge is unavailable",
  );
});

test("keeps callback ids unique when earlier requests finish out of order", async () => {
  const messages: Array<{ callback: string; api: string }> = [];
  testGlobal.tgg = {
    postMessage(message: string) {
      messages.push(JSON.parse(message) as { callback: string; api: string });
    },
  };

  const sdk = createMiniAppSDK();
  const userIdPromise = sdk.getUserId();
  const communityIdPromise = sdk.getCommunityId();

  sdk.resolve("tgg_cb_1", "user-123");
  await expect(userIdPromise).resolves.toBe("user-123");

  const oauthCodePromise = sdk.getOauthCode();

  expect(messages).toEqual([
    {
      callback: "tgg_cb_1",
      api: "getUserId",
    },
    {
      callback: "tgg_cb_2",
      api: "getCommunityId",
    },
    {
      callback: "tgg_cb_3",
      api: "getOauthCode",
    },
  ]);

  sdk.resolve("tgg_cb_2", "community-123");
  sdk.resolve("tgg_cb_3", "oauth-code-123");

  await expect(communityIdPromise).resolves.toBe("community-123");
  await expect(oauthCodePromise).resolves.toBe("oauth-code-123");
});

test("rejects pending calls when native side reports an error", async () => {
  testGlobal.tgg = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getOauthCode();

  sdk.reject("tgg_cb_1", {
    message: "OAuth is unavailable",
    code: "OAUTH_UNAVAILABLE",
  });

  await expect(promise).rejects.toMatchObject({
    message: "OAuth is unavailable",
    code: "OAUTH_UNAVAILABLE",
  });
});

test("rejects when bridge is unavailable", async () => {
  const sdk = createMiniAppSDK();

  await expect(sdk.getCommunityId()).rejects.toThrow("TeamGaga miniapp bridge is unavailable");
});

test("allows custom bridge names for host integration tests", async () => {
  const messages: unknown[] = [];
  testGlobal.CustomMiniAppBridge = {
    postMessage(message: string) {
      messages.push(JSON.parse(message));
    },
  };

  const sdk = createMiniAppSDK({ bridgeName: "CustomMiniAppBridge" });
  const promise = sdk.getSystemInfo();

  expect(messages).toEqual([
    {
      callback: "tgg_cb_1",
      api: "getSystemInfo",
    },
  ]);

  sdk.resolve("tgg_cb_1", {
    platform: "ios",
    appVersion: "1.0.0",
  });

  await expect(promise).resolves.toEqual({
    platform: "ios",
    appVersion: "1.0.0",
  });

  delete testGlobal.CustomMiniAppBridge;
});
