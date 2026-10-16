import { afterEach, expect, test, vi } from "vite-plus/test";

import {
  createMiniAppSDK,
  createTggRuntime,
  getSupportedCapabilities,
  openShare,
  tgg,
} from "../src/index";
import type { MiniAppInvokeRequest, OpenShareOptions } from "../src/index";

const testGlobal = globalThis as typeof globalThis & Record<string, unknown>;
const fullOptions: OpenShareOptions = {
  type: "text",
  title: "分享标题",
  description: "",
  image: "https://example.com/cover.png",
  icon: "https://example.com/icon.png",
  internalLink: "https://example.com/app?item=1#detail",
  externalLink: "https://example.com/share",
};

afterEach(() => {
  for (const key of [
    "tgg",
    "flutter_inappwebview",
    "nativeBridge",
    "__tgg_resolve",
    "__tgg_emit",
    "__tgg_has_event_handlers",
  ]) {
    Reflect.deleteProperty(testGlobal, key);
  }
});

const installHost = (transport: string, response = { success: true } as unknown) => {
  const requests: MiniAppInvokeRequest[] = [];
  if (transport === "flutter_inappwebview") {
    testGlobal.flutter_inappwebview = {
      callHandler: vi.fn(async (name: string, request: MiniAppInvokeRequest) => {
        expect(name).toBe("nativeBridge");
        requests.push(request);
        return response;
      }),
    };
  } else {
    testGlobal.nativeBridge = {
      postMessage(message: string) {
        const request = JSON.parse(message) as MiniAppInvokeRequest;
        requests.push(request);
        const resolve = testGlobal.__tgg_resolve as (id: string, envelope: unknown) => void;
        resolve(request.id, response);
      },
    };
  }
  return requests;
};

test.each(["flutter_inappwebview", "webview_flutter"])(
  "openShare forwards optional fields unchanged over %s",
  async (transport) => {
    const requests = installHost(transport);
    const sdk = createMiniAppSDK();

    await expect(sdk.openShare()).resolves.toBeUndefined();
    await expect(sdk.openShare(fullOptions)).resolves.toBeUndefined();

    expect(requests.map(({ method, params }) => ({ method, params }))).toEqual([
      { method: "openShare", params: {} },
      { method: "openShare", params: fullOptions },
    ]);
  },
);

test("openShare is exposed by the injected runtime, proxy, and named export", async () => {
  const requests = installHost("flutter_inappwebview");
  const runtime = createTggRuntime();

  expect(runtime.canIUse("openShare")).toBe(true);
  expect(getSupportedCapabilities()).toContain("openShare");
  await tgg.openShare({ type: "card" });
  await openShare(fullOptions);
  expect(requests.map(({ params }) => params)).toEqual([{ type: "card" }, fullOptions]);
});

test("openShare rejects disabled capabilities without calling native", async () => {
  const requests = installHost("flutter_inappwebview");
  const sdk = createMiniAppSDK({ capabilities: [{ name: "openShare", enabled: false }] });

  expect(sdk.canIUse("openShare")).toBe(false);
  await expect(sdk.openShare()).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  expect(requests).toHaveLength(0);
});

test.each(["flutter_inappwebview", "webview_flutter"])(
  "openShare propagates host failures over %s",
  async (transport) => {
    installHost(transport, {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Cannot open share panel" },
    });

    await expect(createMiniAppSDK().openShare()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Cannot open share panel",
    });
  },
);
