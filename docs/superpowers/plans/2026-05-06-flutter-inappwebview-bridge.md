# Flutter InAppWebView Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `TeamgagaBridge.postMessage` protocol with a clean Flutter InAppWebView `callHandler` bridge, runtime event entrypoint, and capability checks.

**Architecture:** `src/bridge.ts` owns the Flutter InAppWebView transport and response normalization. `src/sdk.ts` owns developer API ergonomics and delegates every native API through a single `invoke`. `src/core-runtime.ts` mounts `window.tgg`, installs `window.__tgg_emit`, and configures capability behavior for the injected runtime.

**Tech Stack:** TypeScript, Rollup, vite-plus tests, Flutter InAppWebView JavaScript handler contract.

---

## File Structure

- Modify `src/types.ts`: remove legacy bridge callback types; add invoke request/response, Flutter bridge, transport, capability, runtime, and event global types.
- Modify `src/bridge.ts`: replace callback-id `postMessage` client with `createBridgeClient` built on `window.flutter_inappwebview.callHandler`.
- Modify `src/sdk.ts`: expose `invoke`, remove `resolve`/`reject`, preserve high-level API helpers, BackButton listener behavior, and generic CustomEvent dispatch.
- Modify `src/core-runtime.ts`: install runtime metadata, capabilities, and `window.__tgg_emit`.
- Modify `src/constants.ts`: replace callback prefix with invoke id prefix and handler/event constants.
- Modify `src/index.ts`: update exported types to match the new public surface.
- Modify `test/index.test.ts`: rewrite bridge tests around `flutter_inappwebview.callHandler`, event emission, and capability behavior.
- Modify `README.md` and `docs/developer-api.md`: document UserScript, `addJavaScriptHandler`, `callHandler`, `evaluateJavascript`, and `window.__tgg_emit`.

## Task 1: Rewrite Tests For The New Protocol

**Files:**

- Modify: `test/index.test.ts`

- [ ] Replace the test helper types with:

```ts
type TestGlobal = typeof globalThis & Record<string, unknown>;
type TestFlutterBridge = {
  callHandler(handlerName: string, payload: unknown): Promise<unknown>;
};
```

- [ ] In `afterEach`, delete `testGlobal.flutter_inappwebview` and `testGlobal.__tgg_emit`; stop deleting `testGlobal.TeamgagaBridge`.

- [ ] Replace `calls the Flutter WebView bridge with callback id and api name` with a test named `calls Flutter InAppWebView nativeBridge with invoke payload`:

```ts
test("calls Flutter InAppWebView nativeBridge with invoke payload", async () => {
  const calls: Array<{ handlerName: string; payload: Record<string, unknown> }> = [];
  testGlobal.flutter_inappwebview = {
    async callHandler(handlerName: string, payload: unknown) {
      calls.push({ handlerName, payload: payload as Record<string, unknown> });
      return { success: true, data: "user-123" };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK();

  await expect(sdk.getUserId()).resolves.toBe("user-123");
  expect(calls).toHaveLength(1);
  expect(calls[0].handlerName).toBe("nativeBridge");
  expect(calls[0].payload).toMatchObject({
    id: "tgg_req_1",
    method: "getUserId",
    sdkVersion: "0.1.5",
  });
  expect(typeof calls[0].payload.timestamp).toBe("number");
});
```

- [ ] Add tests for response normalization:

```ts
test("normalizes successful native response envelopes", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true, data: { userId: "user-123" } };
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK();

  await expect(sdk.getUserInfo()).resolves.toEqual({ userId: "user-123" });
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

  const sdk = createMiniAppSDK();

  await expect(sdk.getUserInfo()).rejects.toMatchObject({
    code: "USER_UNAVAILABLE",
    message: "User is unavailable",
  });
});

test("accepts primitive native responses as resolved values", async () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return "oauth-code-123";
    },
  } satisfies TestFlutterBridge;

  const sdk = createMiniAppSDK();

  await expect(sdk.getOauthCode()).resolves.toBe("oauth-code-123");
});
```

- [ ] Replace missing bridge test with:

```ts
test("rejects when Flutter InAppWebView bridge is unavailable", async () => {
  const sdk = createMiniAppSDK();

  await expect(sdk.ready()).rejects.toThrow("TeamGaga Flutter InAppWebView bridge is unavailable");
});
```

- [ ] Remove tests that assert `bridge.tgg_cb_1`, `sdk.resolve`, `sdk.reject`, custom bridge names, and out-of-order callback ids.

- [ ] Add runtime/event tests:

```ts
test("creates runtime and installs the Flutter event emitter", () => {
  testGlobal.flutter_inappwebview = {
    async callHandler() {
      return { success: true };
    },
  } satisfies TestFlutterBridge;

  const runtime = createTggRuntime({
    appVersion: "3.2.0",
    platform: "ios",
  });

  expect(testGlobal.tgg).toBe(runtime);
  expect(testGlobal.__tgg_emit).toEqual(expect.any(Function));
  expect(runtime.appVersion).toBe("3.2.0");
  expect(runtime.platform).toBe("ios");
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

  (testGlobal.__tgg_emit as (eventName: string, payload?: unknown) => void)("back_button_clicked");

  expect(handler).toHaveBeenCalledOnce();
});
```

- [ ] Add capability tests:

```ts
test("canIUse reflects capability support", () => {
  const runtime = createTggRuntime();

  expect(runtime.canIUse("getSystemInfo")).toBe(true);
  expect(runtime.canIUse("getUserInfo")).toBe(true);
  expect(runtime.canIUse("setHeaderColor")).toBe(true);
  expect(runtime.canIUse("unknown")).toBe(false);
});
```

- [ ] Run `pnpm test test/index.test.ts`.
      Expected: failures because the implementation still uses `TeamgagaBridge.postMessage`, exposes `resolve/reject`, and does not install `__tgg_emit`.

## Task 2: Update Types And Constants

**Files:**

- Modify: `src/types.ts`
- Modify: `src/constants.ts`
- Modify: `src/index.ts`

- [ ] In `src/constants.ts`, replace callback constants with:

```ts
export const DEFAULT_NATIVE_HANDLER_NAME = "nativeBridge";
export const TGG_GLOBAL_NAME = "tgg";
export const TGG_EVENT_GLOBAL_NAME = "__tgg_emit";
export const REQUEST_ID_PREFIX = "tgg_req_";
export const SDK_NOT_INJECTED_MESSAGE =
  "[Teamgaga] window.tgg is not injected. Please run inside Teamgaga App.";
export const FLUTTER_BRIDGE_UNAVAILABLE_MESSAGE =
  "TeamGaga Flutter InAppWebView bridge is unavailable";
export const SDK_VERSION = "0.1.5";
```

- [ ] In `src/types.ts`, remove `MiniAppBridge`, `MiniAppRequest`, `MiniAppNativeCallbackPayload`, `resolve`, and `reject`.

- [ ] In `src/types.ts`, add:

```ts
export type MiniAppInvokeRequest = {
  id: string;
  method: MiniAppMethod;
  params?: Record<string, unknown>;
  sdkVersion: string;
  timestamp: number;
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

export type BridgeTransport = {
  send<T>(request: MiniAppInvokeRequest): Promise<T>;
};

export type CapabilityConfig = {
  name: TggCapability;
  minAppVersion?: string;
  enabled?: boolean;
};
```

- [ ] Update options:

```ts
export type MiniAppSDKOptions = {
  handlerName?: string;
  sdkVersion?: string;
  capabilities?: readonly CapabilityConfig[];
};

export type TggRuntimeOptions = MiniAppSDKOptions & {
  appVersion?: string;
  platform?: string;
  version?: string;
};
```

- [ ] Update `MiniAppSDK` and `TggWebApp` to include only the public SDK surface. Keep bridge invocation and native event dispatch internal:

```ts
canIUse(capability: string): boolean;
isVersionAtLeast(version: string): boolean;
onEvent(eventName: TggEventName, callback: (payload?: unknown) => void): void;
offEvent(eventName: TggEventName, callback: (payload?: unknown) => void): void;
```

- [ ] Add global typing:

```ts
declare global {
  interface Window {
    flutter_inappwebview?: FlutterInAppWebViewBridge;
    tgg?: TggWebApp;
    __tgg_emit?: (eventName: TggEventName | string, payload?: unknown) => void;
  }
}
```

- [ ] Update `src/index.ts` type exports to remove `MiniAppBridge`, `MiniAppRequest`, and add `BridgeTransport`, `FlutterInAppWebViewBridge`, `CapabilityConfig`, `MiniAppInvokeRequest`, and `MiniAppInvokeResponse`.

- [ ] Run `pnpm run typecheck`.
      Expected: type errors in `src/bridge.ts`, `src/sdk.ts`, and tests because implementation still references removed types.

## Task 3: Implement Flutter Transport

**Files:**

- Modify: `src/bridge.ts`

- [ ] Replace the file with a `callHandler` transport implementation:

```ts
import {
  DEFAULT_NATIVE_HANDLER_NAME,
  FLUTTER_BRIDGE_UNAVAILABLE_MESSAGE,
  REQUEST_ID_PREFIX,
  SDK_VERSION,
} from "./constants";
import { createMiniAppError, toMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  BridgeTransport,
  FlutterInAppWebViewBridge,
  MiniAppInvokeFailureResponse,
  MiniAppInvokeRequest,
  MiniAppInvokeResponse,
  MiniAppMethod,
  MiniAppNativeError,
} from "./types";

type MiniAppBridgeClientOptions = {
  handlerName?: string;
  sdkVersion?: string;
};

export type MiniAppBridgeClient = {
  invoke<T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T>;
};

export const createFlutterInAppWebViewTransport = (
  handlerName = DEFAULT_NATIVE_HANDLER_NAME,
): BridgeTransport => ({
  async send<T>(request: MiniAppInvokeRequest): Promise<T> {
    const bridge = getFlutterBridge();

    if (!bridge) {
      throw createMiniAppError(FLUTTER_BRIDGE_UNAVAILABLE_MESSAGE);
    }

    const response = await bridge.callHandler(handlerName, request);
    return normalizeNativeResponse<T>(response);
  },
});

export const createBridgeClient = (
  options: MiniAppBridgeClientOptions = {},
): MiniAppBridgeClient => {
  const transport = createFlutterInAppWebViewTransport(options.handlerName);
  const sdkVersion = options.sdkVersion ?? SDK_VERSION;
  let requestSequence = 0;

  const createRequestId = (): string => {
    requestSequence += 1;
    return `${REQUEST_ID_PREFIX}${requestSequence}`;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    const request: MiniAppInvokeRequest = {
      id: createRequestId(),
      method,
      ...(params ? { params } : {}),
      sdkVersion,
      timestamp: Date.now(),
    };

    return transport.send<T>(request);
  };

  return { invoke };
};

const getFlutterBridge = (): FlutterInAppWebViewBridge | undefined => {
  const global = getRuntimeGlobal() as typeof globalThis & {
    flutter_inappwebview?: FlutterInAppWebViewBridge;
  };
  const bridge = global.flutter_inappwebview;

  if (!bridge || typeof bridge.callHandler !== "function") {
    return undefined;
  }

  return bridge;
};

const normalizeNativeResponse = <T>(response: unknown): T => {
  const parsedResponse = parseNativeResponse(response);

  if (!isRecord(parsedResponse) || !("success" in parsedResponse)) {
    return parsedResponse as T;
  }

  const envelope = parsedResponse as MiniAppInvokeResponse<T>;

  if (envelope.success) {
    return envelope.data as T;
  }

  throw toMiniAppError(getNativeError(envelope));
};

const getNativeError = (response: MiniAppInvokeFailureResponse): MiniAppNativeError | string => {
  if (response.error) {
    return response.error;
  }

  return {
    code: typeof response.code === "string" ? response.code : undefined,
    message: typeof response.message === "string" ? response.message : undefined,
  };
};

const parseNativeResponse = (response: unknown): unknown => {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response) as unknown;
  } catch {
    return response;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
```

- [ ] Run `pnpm test test/index.test.ts`.
      Expected: fewer failures; runtime and permission tests still fail until SDK/runtime are updated.

## Task 4: Refactor SDK Runtime API

**Files:**

- Modify: `src/sdk.ts`

- [ ] Add permission and capability helpers near the top of `src/sdk.ts`:

```ts
const DEFAULT_CAPABILITIES: readonly CapabilityConfig[] = [
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
  { name: "theme_changed" },
  { name: "back_button_clicked" },
];
```

- [ ] In `createMiniAppSDK`, build `capabilities` and `bridgeClient` from options:

```ts
const bridgeClient = createBridgeClient({
  handlerName: options.handlerName,
  sdkVersion: options.sdkVersion,
});
const capabilities = new Map<string, CapabilityConfig>(
  [...DEFAULT_CAPABILITIES, ...(options.capabilities ?? [])].map((capability) => [
    capability.name,
    capability,
  ]),
);
```

- [ ] Add local `canIUse`:

```ts
const canIUse = (capabilityName: string): boolean => {
  const capability = capabilities.get(capabilityName);

  if (!capability || capability.enabled === false) {
    return false;
  }

  return true;
};
```

- [ ] Add local `invoke`:

```ts
const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
  if (!canIUse(method)) {
    return Promise.reject(
      createMiniAppError(`Unsupported capability: ${method}`, {
        code: "UNSUPPORTED_CAPABILITY",
      }),
    );
  }

  return bridgeClient.invoke<T>(method, params);
};
```

- [ ] Keep `invoke` internal to `createMiniAppSDK`, expose `canIUse`, and implement high-level methods through the internal invoker. Do not expose `resolve`/`reject`/`bridgeName` or `receiveEvent`.

- [ ] Keep BackButton listener behavior unchanged. Native event dispatch should use an internal receiver rather than a public `runtime.receiveEvent(...)` method.

- [ ] Run `pnpm test test/index.test.ts`.
      Expected: bridge and capability tests pass; `createTggRuntime` and `__tgg_emit` tests still fail until runtime install is updated.

## Task 5: Install Runtime Event Global And Metadata

**Files:**

- Modify: `src/core-runtime.ts`

- [ ] Remove local hard-coded `SUPPORTED_CAPABILITIES` set.

- [ ] Update `createTggRuntime` so it calls `createMiniAppSDK(options)` and spreads the SDK into:

```ts
const runtime: TggWebApp = {
  ...sdk,
  appVersion: options.appVersion ?? "",
  platform: options.platform ?? "web",
  sdkVersion: options.sdkVersion ?? SDK_VERSION,
  version: options.version ?? SDK_VERSION,
};
```

- [ ] Mount `window.tgg = runtime`.

- [ ] Install `window.__tgg_emit`:

```ts
global[TGG_EVENT_GLOBAL_NAME] = (eventName: string, payload?: unknown) => {
  receiveMiniAppSDKEvent(sdk, eventName as TggEventName, payload);
  dispatchTggCustomEvent(eventName, payload);
};
```

- [ ] Add `dispatchTggCustomEvent`:

```ts
const dispatchTggCustomEvent = (eventName: string, payload?: unknown): void => {
  const global = getRuntimeGlobal();

  if (typeof global.dispatchEvent !== "function" || typeof global.CustomEvent !== "function") {
    return;
  }

  global.dispatchEvent(
    new global.CustomEvent("tgg:event", {
      detail: {
        eventName,
        payload,
      },
    }),
  );
};
```

- [ ] Update `installTggRuntime` so an existing runtime is reused only when it has `invoke`, `canIUse`, and `BackButton`.

- [ ] Update `getSupportedCapabilities` to return known method capabilities from a shared SDK export or duplicate the method list temporarily in this file.

- [ ] Run `pnpm test test/index.test.ts`.
      Expected: runtime install and event tests pass.

## Task 6: Update Documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/developer-api.md`

- [ ] Replace README Flutter host integration section with:

````md
## Flutter Host Integration

Flutter should inject `dist/core.js` at document start with an InAppWebView
`UserScript`. The host should register a JavaScript handler named
`nativeBridge`:

```dart
controller.addJavaScriptHandler(
  handlerName: 'nativeBridge',
  callback: (args) async {
    final payload = args.first as Map<String, dynamic>;
    final method = payload['method'] as String;
    final params = payload['params'] as Map<String, dynamic>?;

    try {
      final data = await dispatchMiniAppMethod(method, params);
      return {'success': true, 'data': data};
    } catch (error) {
      return {
        'success': false,
        'error': {'message': error.toString()},
      };
    }
  },
);
```
````

H5 calls native through:

```js
window.flutter_inappwebview.callHandler("nativeBridge", {
  id: "tgg_req_1",
  method: "getUserInfo",
  sdkVersion: "0.1.5",
  timestamp: Date.now(),
});
```

Flutter emits events back to H5 with `evaluateJavascript`:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("back_button_clicked")',
);
```

````

- [ ] Remove all README references to `TeamgagaBridge`, `postMessage`, callback names, `window.tgg.resolve`, and `window.tgg.reject`.

- [ ] In `docs/developer-api.md`, update the basic explanation so `core.js` communicates through Flutter InAppWebView `callHandler`, and add a host-only note for `window.__tgg_emit`.

- [ ] Run `rg -n "TeamgagaBridge|postMessage|tgg_cb_|resolve\\(|reject\\(" README.md docs/developer-api.md src test`.
  Expected: no matches except ordinary Promise wording if it does not describe removed runtime APIs.

## Task 7: Final Verification And Commit

**Files:**

- All touched files

- [ ] Run `pnpm test`.
  Expected: all tests pass.

- [ ] Run `pnpm run typecheck`.
  Expected: no TypeScript errors.

- [ ] Run `pnpm run build`.
  Expected: Rollup and declaration generation complete successfully.

- [ ] Run `rg -n "TeamgagaBridge|postMessage|tgg_cb_|window\\.tgg\\.resolve|window\\.tgg\\.reject" src test README.md docs/developer-api.md`.
  Expected: no matches.

- [ ] Run `git diff --stat`.
  Expected: changes are scoped to bridge/runtime/sdk/types/tests/docs and the implementation plan.

- [ ] Commit:

```bash
git add src test README.md docs/developer-api.md docs/superpowers/plans/2026-05-06-flutter-inappwebview-bridge.md
git commit -m "refactor: use flutter inappwebview bridge"
````
