# Runtime SDK Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the package surface into an injected `core.js` runtime and a developer-facing TypeScript SDK proxy.

**Architecture:** `core.js` mounts `window.tgg` and owns bridge calls, callbacks, events, readiness, versions, and UI APIs. The npm SDK exports types, `getTgg()`, and a typed `tgg` proxy that forwards to the injected runtime without creating it.

**Tech Stack:** TypeScript, Rollup, vite-plus tests, Flutter WebView JavaScriptChannel.

---

### Task 1: Add Runtime And Proxy Tests

**Files:**

- Modify: `test/index.test.ts`
- Modify: `test/package.test.ts`

- [ ] Add tests proving `getTgg()` returns `window.tgg`, `tgg` proxies calls to `window.tgg`, and both fail clearly when the runtime is not injected.
- [ ] Add tests proving `createTggRuntime()` mounts `window.tgg`, sends invoke messages through `TeamgagaBridge.postMessage`, resolves callbacks, exposes `ready`, `setTitle`, `setHeaderColor`, `BackButton`, and `canIUse`.
- [ ] Run `pnpm test` and confirm the new tests fail because the runtime split does not exist yet.

### Task 2: Implement Runtime Boundary

**Files:**

- Create: `src/core.ts`
- Modify: `src/bridge.ts`
- Modify: `src/constants.ts`
- Modify: `src/sdk.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`

- [ ] Add public `TggWebApp` types and bridge method/event types.
- [ ] Add `createTggRuntime()` that mounts `window.tgg` and uses `TeamgagaBridge` for native calls.
- [ ] Keep existing legacy API helpers where practical, but route the default developer experience through `getTgg()` and `tgg`.
- [ ] Add a core entry that auto-installs the runtime when bundled as `dist/core.js`.

### Task 3: Build And Package Outputs

**Files:**

- Modify: `rollup.config.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] Add Rollup outputs for `dist/core.js` and `dist/core.min.js`.
- [ ] Export the SDK entry and the core entry from package metadata.
- [ ] Document that npm is for development-time types/proxy and Flutter injects `core.js` at runtime.

### Task 4: Verify

**Files:**

- All touched files

- [ ] Run `pnpm test`.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm run typecheck`.
- [ ] Inspect `git diff --stat` and confirm changes match the requested scope.
