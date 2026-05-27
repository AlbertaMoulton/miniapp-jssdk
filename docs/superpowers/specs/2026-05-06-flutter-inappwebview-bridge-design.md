# Flutter InAppWebView Bridge Refactor Design

## Goal

Refactor the SDK around a clean Flutter/WebView miniapp container protocol. This
is a from-zero-to-one container implementation, so the code should not keep
legacy `TeamgagaBridge.postMessage` behavior, callback-id response handling,
public internal bridge methods, or compatibility branches.

The target split is:

- `core.js` is the injected platform protocol layer. It mounts `window.tgg`,
  owns native transport calls, exposes host-only event entrypoints, and enforces
  version, capability, and permission checks.
- `@teamgaga/miniapp-jssdk` is the developer-facing TypeScript SDK. It provides
  types, helpers, and a typed proxy to the injected runtime.
- Flutter owns native capability execution through
  `window.flutter_inappwebview.callHandler("nativeBridge", payload)` or
  `window.nativeBridge.postMessage(JSON.stringify(payload))` and pushes events
  to H5 with `evaluateJavascript`.

## Non-Goals

- Do not support `TeamgagaBridge.postMessage`.
- Do not preserve callback ids such as `tgg_cb_1`.
- Do not use legacy `TeamgagaBridge.postMessage`.
- Do not add iframe sandbox transport in this refactor.

## Architecture

The runtime stack should be:

```text
Miniapp H5
  -> @teamgaga/miniapp-jssdk
  -> window.tgg
  -> core.js protocol runtime
  -> FlutterInAppWebViewTransport or WebViewFlutterTransport
  -> window.flutter_inappwebview.callHandler("nativeBridge", request)
     or window.nativeBridge.postMessage(JSON.stringify(request))
  -> Flutter native handler
```

Flutter-to-H5 events should use:

```text
Flutter controller.evaluateJavascript(...)
  -> window.__tgg_emit(eventName, payload)
  -> core runtime event dispatch
  -> SDK listeners and CustomEvent subscribers
```

`postMessage` remains a possible future mechanism for web-internal iframe or
sandbox communication, but it is not part of the current bridge protocol.

## Public Runtime Surface

`core.js` should mount `window.tgg` at document start.

`window.tgg` should expose only the public runtime surface:

- high-level API methods such as `ready`, `close`, `getUserInfo`,
  `getSystemInfo`, `readTextFromClipboard`, and `BackButton.show`
- `canIUse(capability)` and `isVersionAtLeast(version)`
- event APIs: `onEvent(eventName, callback)`, `offEvent(eventName, callback)`,
  and `BackButton.onClick`
- version and environment metadata: `version`, `sdkVersion`, `appVersion`,
  `platform`, `colorScheme`, `themeParams`, `viewportHeight`,
  `viewportStableHeight`, `safeAreaInset`, `contentSafeAreaInset`

`invoke` and native event dispatch are internal implementation details and
should not be exposed on `window.tgg`.

`core.js` should also mount a host-only global:

- `window.__tgg_emit(eventName, payload?)`

Flutter should call `window.__tgg_emit` from `evaluateJavascript` for events
such as back button clicks and theme changes. The runtime should not require
Flutter to call private SDK internals.

## H5 To Flutter Protocol

Native calls should go through the best available host bridge:

```ts
window.flutter_inappwebview.callHandler("nativeBridge", request);
// or
window.nativeBridge.postMessage(JSON.stringify(request));
```

The request shape should be:

```ts
type MiniAppInvokeRequest = {
  id: string;
  method: MiniAppMethod;
  params?: Record<string, unknown>;
  sdkVersion: string;
  timestamp: number;
};
```

The response shape should be normalized by `core.js`:

```ts
type MiniAppInvokeResponse<T = unknown> =
  | {
      success: true;
      data?: T;
    }
  | {
      success: false;
      error?: {
        code?: string;
        message?: string;
      };
      code?: string;
      message?: string;
    };
```

The transport should accept direct primitive/object responses as a convenience,
but the documented Flutter contract should be the `success/data/error` envelope.

## Flutter To H5 Protocol

Flutter should emit events with `evaluateJavascript`:

```js
window.__tgg_emit("back_button_clicked", undefined);
window.__tgg_emit("theme_changed", { colorScheme: "dark" });
```

The runtime should:

- route known SDK events to typed SDK listeners
- dispatch a browser `CustomEvent` for generic event subscribers
- isolate listener failures so one failing handler does not block other handlers
- ignore unknown events unless a generic subscriber is listening

## Version And Capability Detection

Capabilities should be modeled as data rather than hard-coded checks scattered
through API methods.

The runtime should maintain a capability registry with:

- capability name
- minimum app version when applicable
- permission requirement when applicable
- whether the capability is currently enabled

`canIUse(capability)` should return `true` only when:

- the runtime knows the capability
- the current app version satisfies the minimum version if one exists
- the capability is enabled

The initial app version should come from `createTggRuntime(options)` so Flutter
can inject host metadata when installing `core.js`.

## Historical Note: Permission Whitelist

This section describes an earlier design direction that was later removed from
the SDK. The current implementation no longer exposes a public runtime
permission whitelist and instead treats documented APIs as directly callable
unless the host integration chooses to constrain them.

The earlier draft proposed a permission whitelist supplied at install time:

```ts
// Historical-only example; no longer part of the public runtime API.
createTggRuntime({
  // permissions: [...]
});
```

This permission model is obsolete and kept here only as historical context.

## File-Level Design

`src/bridge.ts`

- Replace the old `MiniAppBridge.postMessage` implementation with a
  `BridgeTransport` abstraction.
- Implement only `FlutterInAppWebViewTransport`.
- Detect missing `window.flutter_inappwebview.callHandler` and reject with a
  clear SDK error.
- Normalize response envelopes and native error shapes.

`src/types.ts`

- Remove the legacy `MiniAppBridge` shape.
- Add request, response, transport, capability, and runtime option types.
- Add `invoke` to the public `TggWebApp` type.

`src/core-runtime.ts`

- Create the runtime, mount `window.tgg`, and install `window.__tgg_emit`.
- Own capability checks before transport calls.
- Keep SDK-facing methods thin: each method delegates to `invoke`.

`src/sdk.ts`

- Preserve developer-facing imports and the typed `tgg` proxy.
- Remove `resolve` and `reject` APIs from the developer/runtime surface because
  native responses now resolve the `callHandler` promise directly.
- Keep `BackButton` listener ergonomics.

`src/core.ts`

- Continue to auto-install the runtime for the injected `dist/core.js` bundle.

`README.md` and `docs/developer-api.md`

- Document Flutter InAppWebView setup with `UserScript`,
  `addJavaScriptHandler`, `callHandler`, `evaluateJavascript`, and
  `window.__tgg_emit`.
- Remove old `TeamgagaBridge.postMessage` integration examples.

## Testing

Tests should cover:

- SDK proxy still forwards to injected `window.tgg`.
- `createTggRuntime` mounts `window.tgg` and `window.__tgg_emit`.
- H5-to-Flutter invokes
  `window.flutter_inappwebview.callHandler("nativeBridge", request)`.
- successful native response normalization.
- native error response normalization.
- missing Flutter bridge rejection.
- `BackButton.onClick` fires through `window.__tgg_emit("back_button_clicked")`.
- `canIUse` respects known capabilities, app version, and enabled flags.
- package exports still publish SDK and core bundles.

## Migration Effect

This is a breaking protocol change for the host integration, which is acceptable
because the product is being built from zero to one.

Expected removals:

- `TeamgagaBridge`
- `postMessage` transport
- callback ids on the bridge object
- `window.tgg.resolve`
- `window.tgg.reject`

Expected stable developer API:

- `import { tgg } from "@teamgaga/miniapp-jssdk"`
- `tgg.ready()`
- `tgg.getUserInfo()`
- `tgg.BackButton.onClick(cb)`
- `tgg.canIUse(capability)`
