import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import {
  createTggRuntime,
  createMiniAppSDK,
  default as defaultTgg,
  getTgg,
  getCommunityInfo,
  getCommunityId,
  getOauthCode,
  getSystemInfo,
  tgg,
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
  delete testGlobal.TeamgagaBridge;
});

test("calls the Flutter WebView bridge with callback id and api name", async () => {
  const messages: unknown[] = [];
  testGlobal.TeamgagaBridge = {
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
  testGlobal.TeamgagaBridge = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.TeamgagaBridge as TestBridge;

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
  testGlobal.TeamgagaBridge = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.TeamgagaBridge as TestBridge;

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
  testGlobal.TeamgagaBridge = {
    postMessage() {},
  };

  const sdk = createMiniAppSDK();
  const promise = sdk.getUserInfo();
  const bridge = testGlobal.TeamgagaBridge as TestBridge;

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

test("supports default imports as the typed runtime proxy", () => {
  expect(defaultTgg).toBe(tgg);
});

test("keeps callback ids unique when earlier requests finish out of order", async () => {
  const messages: Array<{ callback: string; api: string }> = [];
  testGlobal.TeamgagaBridge = {
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
  testGlobal.TeamgagaBridge = {
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

test("getTgg returns the injected runtime", () => {
  const runtime = {
    version: "0.1.5",
    sdkVersion: "0.1.5",
    platform: "web",
    ready: vi.fn(),
  };
  testGlobal.tgg = runtime;

  expect(getTgg()).toBe(runtime);
});

test("getTgg explains when the injected runtime is missing", () => {
  expect(() => getTgg()).toThrow(
    "[Teamgaga] window.tgg is not injected. Please run inside Teamgaga App.",
  );
});

test("tgg proxy forwards property access to the injected runtime", () => {
  const ready = vi.fn();
  testGlobal.tgg = {
    ready,
  };

  void tgg.ready();

  expect(ready).toHaveBeenCalledOnce();
});

test("creates and mounts the core runtime on window.tgg", async () => {
  const messages: unknown[] = [];
  testGlobal.TeamgagaBridge = {
    postMessage(message: string) {
      messages.push(JSON.parse(message));
    },
  };

  const runtime = createTggRuntime({
    appVersion: "3.2.0",
    platform: "ios",
    version: "1.4.0",
  });
  const promise = runtime.setHeaderColor("bg_color");

  expect(testGlobal.tgg).toBe(runtime);
  expect(runtime.appVersion).toBe("3.2.0");
  expect(runtime.platform).toBe("ios");
  expect(runtime.version).toBe("1.4.0");
  expect(runtime.canIUse("setHeaderColor")).toBe(true);
  expect(runtime.canIUse("BackButton.show")).toBe(true);
  expect(messages).toEqual([
    {
      callback: "tgg_cb_1",
      api: "setHeaderColor",
      params: {
        color: "bg_color",
      },
    },
  ]);

  runtime.resolve("tgg_cb_1", undefined);

  await expect(promise).resolves.toBeUndefined();
});

test("core runtime exposes ready, setTitle, and BackButton APIs", async () => {
  const messages: unknown[] = [];
  testGlobal.TeamgagaBridge = {
    postMessage(message: string) {
      messages.push(JSON.parse(message));
    },
  };

  const runtime = createTggRuntime();

  void runtime.ready();
  const titlePromise = runtime.setTitle("订单详情");
  const backButtonPromise = runtime.BackButton.show();

  expect(messages).toEqual([
    {
      callback: "tgg_cb_1",
      api: "ready",
    },
    {
      callback: "tgg_cb_2",
      api: "setTitle",
      params: {
        title: "订单详情",
      },
    },
    {
      callback: "tgg_cb_3",
      api: "BackButton.show",
    },
  ]);

  runtime.resolve("tgg_cb_2", undefined);
  runtime.resolve("tgg_cb_3", undefined);

  await expect(titlePromise).resolves.toBeUndefined();
  await expect(backButtonPromise).resolves.toBeUndefined();
});
