# TeamGaga MiniApp JS SDK

JavaScript SDK for TeamGaga miniapps running inside the TeamGaga App Flutter WebView container.

## Runtime vs SDK

This package now has two surfaces:

- `dist/core.js`: runtime code for Flutter WebView `UserScript` injection. It mounts `window.tgg`, talks to the native `TeamgagaBridge`, manages callback promises, and exposes Mini App APIs.
- `@teamgaga/miniapp-jssdk`: developer-facing TypeScript SDK. It provides types, helper functions, and a typed `tgg` proxy that forwards to the injected `window.tgg`.

The npm SDK does not create a fake runtime by default. In production, `window.tgg`
must come from the injected core runtime.

Developer-facing API details are available in
[`docs/developer-api.md`](docs/developer-api.md).

## Build

```sh
pnpm run build
```

The build emits SDK bundles and WebView runtime bundles:

- `dist/index.esm.js`
- `dist/index.iife.js`
- `dist/index.iife.min.js`
- `dist/core.esm.js`
- `dist/core.js`
- `dist/core.min.js`
- `dist/index.d.ts`
- `dist/core.d.ts`

## Mini App Usage

```ts
import { tgg } from "@teamgaga/miniapp-jssdk";

tgg.ready();
await tgg.setTitle("订单详情");
await tgg.setHeaderColor("bg_color");
tgg.BackButton.show();
tgg.BackButton.onClick(() => {
  // Custom back navigation
});
```

For explicit access:

```ts
import { getTgg } from "@teamgaga/miniapp-jssdk";

const runtime = getTgg();
await runtime.getUserInfo();
```

`getTgg()` throws a clear error when the app is not running inside TeamGaga and
`window.tgg` has not been injected.

## Flutter Host Integration

Flutter should inject `dist/core.js` at document start. The host should expose
`TeamgagaBridge.postMessage`.
Each request includes a callback name such as `tgg_cb_1`. Native responses can
be completed by calling that callback on the `TeamgagaBridge` object:

```js
TeamgagaBridge.tgg_cb_1({
  userId: "user-123",
  avatar: "https://example.com/avatar.png",
  username: "alice",
  nickname: "Alice",
});
```

The callback also accepts `{ success: true, data }` and rejects on
`{ success: false, code, message }`. The injected runtime also exposes
`window.tgg.resolve(id, value)` and `window.tgg.reject(id, error)` for host
integrations that prefer an explicit runtime namespace.

### Back button click events

When the user taps the back button in the navigation bar, the Flutter host should
notify the JS runtime by calling `window.tgg.receiveEvent("backButtonClicked")`.
This is a host-only runtime entrypoint. The SDK's
`BackButton.onClick(cb)` handlers will fire in response:

```dart
// Flutter — on back button tap
webViewController.runJavaScript('window.tgg.receiveEvent("backButtonClicked")');
```

See the [BackButton event example](#mini-app-usage) above for the developer-side
usage.

## Release

Configure npm Trusted Publishing for `@teamgaga/miniapp-jssdk`:

- Publisher: GitHub Actions
- Owner: `AlbertaMoulton`
- Repository: `miniapp-jssdk`
- Workflow filename: `publish.yml`

Then create a release tag from `main`:

```bash
pnpm run release:patch
git push origin main v0.1.6
```

Use `minor` or `major` when needed. The release script updates `package.json`, runs checks, tests, build, and `pnpm pack --dry-run`, then commits the version bump and creates the tag. GitHub Actions publishes tagged releases to npm.
