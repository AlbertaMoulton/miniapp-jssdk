# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command                  | Usage                                                     |
| ------------------------ | --------------------------------------------------------- |
| `pnpm test`              | Run all tests (vite-plus test runner)                     |
| `pnpm run check`         | Lint + typecheck via vite-plus                            |
| `pnpm run build`         | Clean, rollup bundle, then emit declarations              |
| `pnpm run typecheck`     | TypeScript type check (`tsc --noEmit`)                    |
| `pnpm run lint`          | ESLint via vite-plus                                      |
| `pnpm run fmt`           | Format code via vite-plus                                 |
| `pnpm run ready`         | check → test → build (CI gate)                            |
| `pnpm run release:patch` | Bump patch, run checks, commit, tag (`v0.1.5` → `v0.1.6`) |
| `pnpm run release:minor` | Same for minor bump                                       |
| `pnpm run release:major` | Same for major bump                                       |

## Architecture

This package has **two surfaces** — a runtime injected by the Flutter host, and a dev-facing SDK:

### `src/core.ts` (Flutter WebView runtime)

Entry point for `dist/core.js`. Auto-invokes `installTggRuntime()` on load to mount `window.tgg` before any MiniApp script runs. Injected by the Flutter/WebView host. Talks to native through either Flutter InAppWebView (`window.flutter_inappwebview.callHandler(...)`) or webview_flutter JavaScriptChannel (`window.nativeBridge.postMessage(...)`).

### `@teamgaga/miniapp-jssdk` (developer SDK)

The npm package provides types and a **typed proxy** (`tgg`) that forwards property access to `window.tgg`. It never creates the runtime — `getTgg()` throws if `window.tgg` is missing. Standalone convenience functions (`getUserId()`, `setHeaderColor()`, `readTextFromClipboard()`, etc.) also delegate to `window.tgg`.

### Key modules

- **`src/bridge.ts`** — `createBridgeClient()` creates request IDs (`tgg_req_*`) and sends bridge envelopes to either `flutter_inappwebview.callHandler()` or `nativeBridge.postMessage()`. `nativeBridge` responses resolve through `window.__tgg_resolve(id, envelope)`. Handles raw success values and `{ success: false, code, message }` / `{ success: false, error }` responses.
- **`src/core-runtime.ts`** — `createTggRuntime()` builds the `TggWebApp` object (wraps `MiniAppSDK` + runtime metadata such as theme, viewport, safe area, fullscreen state) and mounts it on `window.tgg`. It also installs `window.__tgg_emit(eventName, payload)` for host-to-H5 runtime events. `installTggRuntime()` is idempotent — skips if already mounted.
- **`src/sdk.ts`** — `createMiniAppSDK()` creates the bridge-powered SDK. `tgg` is a `Proxy` that lazily resolves `window.tgg` on each access. Public events use `onEvent(eventName, cb)` / `offEvent(eventName, cb)` with Telegram-style snake_case event names; internal event dispatch is not part of the public SDK surface.
- **`src/runtime.ts`** — `getRuntimeGlobal()` finds the global scope (`globalThis` → `self` → `window` → `{}`).
- **`src/constants.ts`** — Native handler name (`nativeBridge`), global name (`tgg`), event global (`__tgg_emit`), request ID prefix (`tgg_req_`), SDK version.

### Build outputs (6 bundles via Rollup)

| Entry        | Formats                                                             |
| ------------ | ------------------------------------------------------------------- |
| SDK          | `dist/index.esm.js`, `dist/index.iife.js`, `dist/index.iife.min.js` |
| Core runtime | `dist/core.esm.js`, `dist/core.js`, `dist/core.min.js`              |

Types emitted by `tsc --emitDeclarationOnly` after bundling.

### Native bridge protocol

The SDK sends a request envelope through the best available native bridge.

Flutter InAppWebView:

```ts
window.flutter_inappwebview.callHandler("nativeBridge", request);
```

webview_flutter JavaScriptChannel:

```ts
window.nativeBridge.postMessage(JSON.stringify(request));
```

Request shape:

```json
{
  "id": "tgg_req_1_1",
  "method": "setHeaderColor",
  "params": { "color": "bg_color" },
  "sdkVersion": "0.2.3",
  "timestamp": 1710000000000
}
```

Native can return a raw value or an envelope:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "ERR", "message": "Readable message" } }
```

For `nativeBridge.postMessage()`, native resolves requests by calling:

```js
window.__tgg_resolve("tgg_req_1_1", { success: true, data: {} });
```

Host-to-H5 runtime events use `window.__tgg_emit(eventName, payload)`. Event names are snake_case:

```js
window.__tgg_emit("theme_changed", { colorScheme: "dark" });
window.__tgg_emit("back_button_clicked");
```

### Release flow

`scripts/release.mjs` bumps version, runs `pnpm run ready`, does `pnpm pack --dry-run`, commits `package.json`, and creates a tag. Push the tag to trigger the GitHub Actions publish workflow, which verifies the tag and publishes the workspace directly to npm with Trusted Publishing.
