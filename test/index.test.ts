import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import {
  createMiniAppSDK,
  createTggRuntime,
  default as defaultTgg,
  getCommunityId,
  getCommunityInfo,
  getOauthCode,
  getSystemInfo,
  getTgg,
  getUserId,
  getUserInfo,
  setHeaderColor,
  tgg,
} from "../src/index";

type TestGlobal = typeof globalThis & Record<string, unknown>;
type TestFlutterBridge = {
  callHandler(handlerName: string, payload: unknown): Promise<unknown>;
};

const testGlobal = globalThis as TestGlobal;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-06T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete testGlobal.tgg;
  delete testGlobal.__tgg_emit;
  delete testGlobal.flutter_inappwebview;
});

test("calls Flutter InAppWebView nativeBridge with invoke payload", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true, data: "user-123" };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read"] });

  await expect(sdk.getUserId()).resolves.toBe("user-123");
  expect(calls).toHaveLength(1);
  expect(calls[0].handlerName).toBe("nativeBridge");
  expect(calls[0].payload).toMatchObject({
    id: "tgg_req_1",
    method: "getUserId",
    sdkVersion: "0.1.5",
    timestamp: new Date("2026-05-06T00:00:00.000Z").getTime(),
  });
});

test("passes invoke params to Flutter InAppWebView", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK();

  await expect(sdk.setHeaderColor("bg_color")).resolves.toBeUndefined();
  expect(calls[0]).toMatchObject({
    handlerName: "nativeBridge",
    payload: {
      id: "tgg_req_1",
      method: "setHeaderColor",
      params: {
        color: "bg_color",
      },
    },
  });
});

test("init handshakes with Flutter and returns startup context", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return {
        success: true,
        data: {
          appVersion: "3.4.0",
          sdkVersion: "0.2.0",
          colorScheme: "dark",
          platform: "ios",
          launchContext: {
            scene: "community",
            communityId: "community-123",
          },
        },
      };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK();

  await expect(sdk.init()).resolves.toEqual({
    appVersion: "3.4.0",
    sdkVersion: "0.2.0",
    colorScheme: "dark",
    platform: "ios",
    launchContext: {
      scene: "community",
      communityId: "community-123",
    },
  });
  expect(calls[0]).toMatchObject({
    handlerName: "nativeBridge",
    payload: {
      id: "tgg_req_1",
      method: "init",
    },
  });
});

test("supports custom native handler names", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ handlerName: "customNativeBridge" });

  await expect(sdk.ready()).resolves.toBeUndefined();
  expect(calls[0].handlerName).toBe("customNativeBridge");
});

test("normalizes successful native response envelopes", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return {
        success: true,
        data: {
          userId: "user-123",
          avatar: "https://example.com/avatar.png",
          username: "alice",
          nickname: "Alice",
        },
      };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read"] });

  await expect(sdk.getUserInfo()).resolves.toEqual({
    userId: "user-123",
    avatar: "https://example.com/avatar.png",
    username: "alice",
    nickname: "Alice",
  });
});

test("rejects native error response envelopes", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return {
        success: false,
        error: { code: "USER_UNAVAILABLE", message: "User is unavailable" },
      };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read"] });

  await expect(sdk.getUserInfo()).rejects.toMatchObject({
    code: "USER_UNAVAILABLE",
    message: "User is unavailable",
  });
});

test("rejects native error response shorthand", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return {
        success: false,
        code: "OAUTH_UNAVAILABLE",
        message: "OAuth is unavailable",
      };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read"] });

  await expect(sdk.getOauthCode()).rejects.toMatchObject({
    code: "OAUTH_UNAVAILABLE",
    message: "OAuth is unavailable",
  });
});

test("parses JSON string native response envelopes", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return JSON.stringify({ success: true, data: "community-123" });
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["community:read"] });

  await expect(sdk.getCommunityId()).resolves.toBe("community-123");
});

test("accepts primitive native responses as resolved values", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return "oauth-code-123";
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read"] });

  await expect(sdk.getOauthCode()).resolves.toBe("oauth-code-123");
});

test("exposes all known miniapp API helper methods", () => {
  expect(getOauthCode).toEqual(expect.any(Function));
  expect(getUserId).toEqual(expect.any(Function));
  expect(getUserInfo).toEqual(expect.any(Function));
  expect(getSystemInfo).toEqual(expect.any(Function));
  expect(getCommunityId).toEqual(expect.any(Function));
  expect(getCommunityInfo).toEqual(expect.any(Function));
  expect(setHeaderColor).toEqual(expect.any(Function));
});

test("supports default imports as the typed runtime proxy", () => {
  expect(defaultTgg).toBe(tgg);
});

test("keeps invoke ids unique across requests", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true, data: "ok" };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK({ permissions: ["user:read", "community:read"] });

  await sdk.getUserId();
  await sdk.getCommunityId();
  await sdk.getOauthCode();

  expect(calls.map((call) => call.payload.id)).toEqual(["tgg_req_1", "tgg_req_2", "tgg_req_3"]);
});

test("rejects when Flutter InAppWebView bridge is unavailable", async () => {
  const sdk = createMiniAppSDK();

  await expect(sdk.ready()).rejects.toThrow("TeamGaga Flutter InAppWebView bridge is unavailable");
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

test("BackButton onClick fires callbacks when backButtonClicked is received", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();
  sdk.BackButton.onClick(handler);

  sdk.receiveEvent("backButtonClicked");

  expect(handler).toHaveBeenCalledOnce();
});

test("BackButton offClick removes a registered callback", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();
  sdk.BackButton.onClick(handler);
  sdk.BackButton.offClick(handler);

  sdk.receiveEvent("backButtonClicked");

  expect(handler).not.toHaveBeenCalled();
});

test("receiveEvent fires all registered BackButton onClick handlers", () => {
  const sdk = createMiniAppSDK();
  const handler1 = vi.fn();
  const handler2 = vi.fn();
  sdk.BackButton.onClick(handler1);
  sdk.BackButton.onClick(handler2);

  sdk.receiveEvent("backButtonClicked");

  expect(handler1).toHaveBeenCalledOnce();
  expect(handler2).toHaveBeenCalledOnce();
});

test("onEvent and offEvent manage generic runtime event listeners", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();

  sdk.onEvent("themeChanged", handler);
  sdk.receiveEvent("themeChanged", { colorScheme: "dark" });
  sdk.offEvent("themeChanged", handler);
  sdk.receiveEvent("themeChanged", { colorScheme: "light" });

  expect(handler).toHaveBeenCalledOnce();
  expect(handler).toHaveBeenCalledWith({ colorScheme: "dark" });
});

test("onEvent deduplicates callbacks for the same event", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();

  sdk.onEvent("themeChanged", handler);
  sdk.onEvent("themeChanged", handler);
  sdk.receiveEvent("themeChanged", { colorScheme: "dark" });

  expect(handler).toHaveBeenCalledOnce();
});

test("onClipboardTextReceived receives clipboard data from native events", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();

  const off = sdk.onClipboardTextReceived(handler);
  sdk.receiveEvent("clipboardTextReceived", { data: "hello" });
  off();
  sdk.receiveEvent("clipboardTextReceived", { data: "ignored" });

  expect(handler).toHaveBeenCalledOnce();
  expect(handler).toHaveBeenCalledWith({ data: "hello" });
});

test("onClipboardTextReceived normalizes missing clipboard data to null", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();

  sdk.onClipboardTextReceived(handler);
  sdk.receiveEvent("clipboardTextReceived", {});

  expect(handler).toHaveBeenCalledWith({ data: null });
});

test("generic onEvent can observe clipboardTextReceived events", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();

  sdk.onEvent("clipboardTextReceived", handler);
  sdk.receiveEvent("clipboardTextReceived", { data: "copied" });

  expect(handler).toHaveBeenCalledWith({ data: "copied" });
});

test("BackButton handlers are isolated when one handler throws", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  const sdk = createMiniAppSDK();
  const error = new Error("handler failed");
  const throwingHandler = vi.fn(() => {
    throw error;
  });
  const nextHandler = vi.fn();
  sdk.BackButton.onClick(throwingHandler);
  sdk.BackButton.onClick(nextHandler);

  expect(() => sdk.receiveEvent("backButtonClicked")).not.toThrow();

  expect(throwingHandler).toHaveBeenCalledOnce();
  expect(nextHandler).toHaveBeenCalledOnce();
  expect(consoleError).toHaveBeenCalledWith("[Teamgaga] BackButton.onClick handler failed", error);

  consoleError.mockRestore();
});

test("BackButton dispatch uses a listener snapshot for the current event", () => {
  const sdk = createMiniAppSDK();
  const lateHandler = vi.fn();
  const firstHandler = vi.fn(() => {
    sdk.BackButton.onClick(lateHandler);
  });
  sdk.BackButton.onClick(firstHandler);

  sdk.receiveEvent("backButtonClicked");

  expect(firstHandler).toHaveBeenCalledOnce();
  expect(lateHandler).not.toHaveBeenCalled();

  sdk.receiveEvent("backButtonClicked");

  expect(firstHandler).toHaveBeenCalledTimes(2);
  expect(lateHandler).toHaveBeenCalledOnce();
});

test("receiveEvent ignores unknown events for typed SDK listeners", () => {
  const sdk = createMiniAppSDK();
  const handler = vi.fn();
  sdk.BackButton.onClick(handler);

  expect(() => sdk.receiveEvent("unknown" as never)).not.toThrow();

  expect(handler).not.toHaveBeenCalled();
});

test("creates runtime and installs the Flutter event emitter", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime({
    appVersion: "3.2.0",
    platform: "ios",
    permissions: ["system:read"],
  });

  expect(testGlobal.tgg).toBe(runtime);
  expect(testGlobal.__tgg_emit).toEqual(expect.any(Function));
  expect(runtime.appVersion).toBe("3.2.0");
  expect(runtime.platform).toBe("ios");
});

test("runtime native APIs call Flutter InAppWebView", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();

  await expect(runtime.ready()).resolves.toBeUndefined();
  await expect(runtime.BackButton.show()).resolves.toBeUndefined();

  expect(calls.map((call) => call.payload.method)).toEqual(["ready", "BackButton.show"]);
});

test("runtime init updates startup metadata before ready is called", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      if ((payload as Record<string, unknown>).method === "init") {
        return {
          success: true,
          data: {
            appVersion: "3.4.0",
            sdkVersion: "0.2.0",
            colorScheme: "dark",
            platform: "android",
            launchContext: {
              source: "push",
            },
          },
        };
      }

      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();

  const initData = await runtime.init();
  await runtime.ready();

  expect(initData.platform).toBe("android");
  expect(runtime.appVersion).toBe("3.4.0");
  expect(runtime.sdkVersion).toBe("0.2.0");
  expect(runtime.colorScheme).toBe("dark");
  expect(runtime.platform).toBe("android");
  expect(runtime.isVersionAtLeast("3.3.0")).toBe(true);
  expect(calls.map((call) => call.payload.method)).toEqual(["init", "ready"]);
});

test("BackButton onClick fires through window.__tgg_emit", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const handler = vi.fn();
  runtime.BackButton.onClick(handler);

  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("backButtonClicked");

  expect(handler).toHaveBeenCalledOnce();
});

test("window.__tgg_emit dispatches generic CustomEvent subscribers", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;
  const dispatchEvent = vi.fn();
  class TestCustomEvent {
    readonly type: string;
    readonly detail: unknown;

    constructor(type: string, options: { detail: unknown }) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  (testGlobal as Record<string, unknown>).dispatchEvent = dispatchEvent;
  (testGlobal as Record<string, unknown>).CustomEvent =
    TestCustomEvent as unknown as typeof CustomEvent;

  createTggRuntime();

  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("themeChanged", {
    colorScheme: "dark",
  });

  expect(dispatchEvent).toHaveBeenCalledOnce();
  expect(dispatchEvent.mock.calls[0][0]).toMatchObject({
    type: "tgg:event",
    detail: {
      eventName: "themeChanged",
      payload: {
        colorScheme: "dark",
      },
    },
  });

  delete (testGlobal as Record<string, unknown>).dispatchEvent;
  delete (testGlobal as Record<string, unknown>).CustomEvent;
});

test("window.__tgg_emit skips CustomEvent dispatch when unavailable", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  createTggRuntime();

  expect(() => {
    (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("themeChanged", {
      colorScheme: "dark",
    });
  }).not.toThrow();
});

test("canIUse respects permission requirements", () => {
  const runtime = createTggRuntime({ permissions: ["system:read"] });

  expect(runtime.canIUse("getSystemInfo")).toBe(true);
  expect(runtime.canIUse("getUserInfo")).toBe(false);
  expect(runtime.canIUse("setHeaderColor")).toBe(true);
  expect(runtime.canIUse("unknown")).toBe(false);
});

test("canIUse respects disabled capability overrides", () => {
  const runtime = createTggRuntime({
    capabilities: [{ name: "setHeaderColor", enabled: false }],
  });

  expect(runtime.canIUse("setHeaderColor")).toBe(false);
});

test("isVersionAtLeast compares semantic app versions", () => {
  const runtime = createTggRuntime({ appVersion: "3.10.1" });

  expect(runtime.isVersionAtLeast("3.10.0")).toBe(true);
  expect(runtime.isVersionAtLeast("3.10.1")).toBe(true);
  expect(runtime.isVersionAtLeast("3.11.0")).toBe(false);
  expect(runtime.isVersionAtLeast("4.0")).toBe(false);
});

test("canIUse respects minimum app versions", () => {
  const runtime = createTggRuntime({
    appVersion: "3.2.0",
    capabilities: [{ name: "setHeaderColor", minAppVersion: "3.3.0" }],
  });

  expect(runtime.canIUse("setHeaderColor")).toBe(false);
});

test("invoke rejects locally when capability requires a newer app version", async () => {
  const calls: unknown[] = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(_handlerName: string, payload: unknown) {
      calls.push(payload);
      return { success: true };
    },
  } satisfies TestFlutterBridge;
  const runtime = createTggRuntime({
    appVersion: "3.2.0",
    capabilities: [{ name: "setHeaderColor", minAppVersion: "3.3.0" }],
  });

  await expect(runtime.setHeaderColor("bg_color")).rejects.toMatchObject({
    code: "UNSUPPORTED_CAPABILITY",
  });
  expect(calls).toEqual([]);
});

test("protected methods reject locally when permission is missing", async () => {
  const calls: unknown[] = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(_handlerName: string, payload: unknown) {
      calls.push(payload);
      return {
        success: true,
        data: {
          userId: "user-123",
          avatar: "https://example.com/avatar.png",
          username: "alice",
          nickname: "Alice",
        },
      };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();

  await expect(runtime.getUserInfo()).rejects.toMatchObject({
    code: "PERMISSION_DENIED",
  });
  expect(calls).toEqual([]);
});

test("BackButton show and hide skip duplicate native calls", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();

  await runtime.BackButton.show();
  await runtime.BackButton.show();
  await runtime.BackButton.hide();
  await runtime.BackButton.hide();

  expect(calls.map((call) => call.payload.method)).toEqual(["BackButton.show", "BackButton.hide"]);
});

test("setHeaderColor rejects invalid color values before native calls", async () => {
  const calls: unknown[] = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(_handlerName: string, payload: unknown) {
      calls.push(payload);
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();

  await expect(runtime.setHeaderColor("red" as never)).rejects.toMatchObject({
    code: "INVALID_HEADER_COLOR",
  });
  await expect(runtime.setHeaderColor("#abc" as never)).rejects.toMatchObject({
    code: "INVALID_HEADER_COLOR",
  });
  expect(calls).toEqual([]);
});

test("downloadFile starts a native download task and returns task controls", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const success = vi.fn();
  const complete = vi.fn();
  const task = runtime.downloadFile({
    url: "https://example.com/report.pdf",
    fileName: "report.pdf",
    success,
    complete,
  });

  expect(typeof task.abort).toBe("function");
  expect(typeof task.onProgressUpdate).toBe("function");
  expect(typeof task.offProgressUpdate).toBe("function");
  expect(calls[0]).toMatchObject({
    handlerName: "nativeBridge",
    payload: {
      method: "downloadFile",
      params: {
        taskId: "tgg_download_1",
        url: "https://example.com/report.pdf",
        fileName: "report.pdf",
      },
    },
  });

  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("downloadFileSuccess", {
    taskId: "tgg_download_1",
    tempFilePath: "/tmp/report.pdf",
  });

  expect(success).toHaveBeenCalledWith({ tempFilePath: "/tmp/report.pdf" });
  expect(complete).toHaveBeenCalledWith({ errMsg: "downloadFile:ok" });
});

test("downloadFile task manages progress listeners", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const progress = vi.fn();
  const task = runtime.downloadFile({
    url: "https://example.com/report.pdf",
  });

  task.onProgressUpdate(progress);
  task.onProgressUpdate(progress);
  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)(
    "downloadFileProgress",
    {
      taskId: "tgg_download_1",
      progress: 42,
    },
  );
  task.offProgressUpdate(progress);
  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)(
    "downloadFileProgress",
    {
      taskId: "tgg_download_1",
      progress: 90,
    },
  );

  expect(progress).toHaveBeenCalledOnce();
  expect(progress).toHaveBeenCalledWith({ progress: 42 });
});

test("downloadFile task dispatches fail and complete on native failure", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const fail = vi.fn();
  const complete = vi.fn();
  runtime.downloadFile({
    url: "https://example.com/report.pdf",
    fail,
    complete,
  });

  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("downloadFileFail", {
    taskId: "tgg_download_1",
    errMsg: "download failed",
  });

  expect(fail).toHaveBeenCalledWith({ errMsg: "download failed" });
  expect(complete).toHaveBeenCalledWith({ errMsg: "download failed" });
});

test("downloadFile abort asks native to cancel the task", () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const fail = vi.fn();
  const complete = vi.fn();
  const task = runtime.downloadFile({
    url: "https://example.com/report.pdf",
    fail,
    complete,
  });

  task.abort();

  expect(calls.map((call) => call.payload.method)).toEqual(["downloadFile", "abortDownloadFile"]);
  expect(calls[1].payload.params).toEqual({ taskId: "tgg_download_1" });
  expect(fail).toHaveBeenCalledWith({ errMsg: "downloadFile:abort" });
  expect(complete).toHaveBeenCalledWith({ errMsg: "downloadFile:abort" });
});

test("downloadFile rejects invalid params locally", () => {
  const calls: unknown[] = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(_handlerName: string, payload: unknown) {
      calls.push(payload);
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime();
  const fail = vi.fn();
  const complete = vi.fn();

  runtime.downloadFile({
    url: "ftp://example.com/report.pdf",
    fileName: "../report.pdf",
    fail,
    complete,
  });

  expect(fail).toHaveBeenCalledWith({ errMsg: "downloadFile:fail invalid url" });
  expect(complete).toHaveBeenCalledWith({ errMsg: "downloadFile:fail invalid url" });
  expect(calls).toEqual([]);
});

test("getSupportedCapabilities returns native method capabilities", async () => {
  const { getSupportedCapabilities } = await import("../src/index");

  expect(getSupportedCapabilities()).toEqual([
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
  ]);
});
