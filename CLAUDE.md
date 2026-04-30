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

Entry point for `dist/core.js`. Auto-invokes `installTggRuntime()` on load to mount `window.tgg` before any MiniApp script runs. Injected via Flutter `UserScript`. Talks to native `TeamgagaBridge.postMessage()`.

### `@teamgaga/miniapp-jssdk` (developer SDK)

The npm package provides types and a **typed proxy** (`tgg`) that forwards property access to `window.tgg`. It never creates the runtime — `getTgg()` throws if `window.tgg` is missing. Standalone convenience functions (`getUserId()`, `setTitle()`, etc.) also delegate to `window.tgg`.

### Key modules

- **`src/bridge.ts`** — `createBridgeClient()` manages callback IDs (`tgg_cb_1`), pending request map, and `postMessage` to the native bridge. Handles both success/callback and `{ success: false, code, message }` error responses.
- **`src/core-runtime.ts`** — `createTggRuntime()` builds the `TggWebApp` object (wraps `MiniAppSDK` + version/platform/capability info) and mounts it on `window.tgg`. `installTggRuntime()` is idempotent — skips if already mounted.
- **`src/sdk.ts`** — `createMiniAppSDK()` creates the bridge-powered SDK. `tgg` is a `Proxy` that lazily resolves `window.tgg` on each access. Standalone helpers for common methods.
- **`src/runtime.ts`** — `getRuntimeGlobal()` finds the global scope (`globalThis` → `self` → `window` → `{}`).
- **`src/constants.ts`** — Bridge name (`TeamgagaBridge`), global name (`tgg`), callback prefix (`tgg_cb_`), SDK version.

### Build outputs (6 bundles via Rollup)

| Entry        | Formats                                                             |
| ------------ | ------------------------------------------------------------------- |
| SDK          | `dist/index.esm.js`, `dist/index.iife.js`, `dist/index.iife.min.js` |
| Core runtime | `dist/core.esm.js`, `dist/core.js`, `dist/core.min.js`              |

Types emitted by `tsc --emitDeclarationOnly` after bundling.

### Native bridge protocol

The SDK sends JSON via `TeamgagaBridge.postMessage()`:

```json
{ "callback": "tgg_cb_1", "api": "setTitle", "params": { "title": "订单详情" } }
```

Native responds by calling the callback function on the bridge:

```js
TeamgagaBridge.tgg_cb_1(/* value */);
// or: TeamgagaBridge.tgg_cb_1({ success: false, code: "ERR", message: "..." });
```

### Release flow

`scripts/release.mjs` bumps version, runs `pnpm run ready`, does `pnpm pack --dry-run`, commits `package.json`, and creates a tag. Push the tag to trigger the GitHub Actions publish workflow (npm trusted publishing).
