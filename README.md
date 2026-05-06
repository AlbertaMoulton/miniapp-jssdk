# TeamGaga MiniApp JS SDK

JavaScript SDK for TeamGaga miniapps running inside the TeamGaga App Flutter WebView container.

## Runtime vs SDK

This package now has two surfaces:

- `dist/core.js`: runtime code for Flutter WebView `UserScript` injection. It mounts `window.tgg`, talks to Flutter InAppWebView through `callHandler`, handles host events, and exposes Mini App APIs.
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
await tgg.setHeaderColor("bg_color");
tgg.BackButton.show();
tgg.BackButton.onClick(() => {
  // Custom back navigation
});
if (tgg.canIUse("setHeaderColor") && tgg.isVersionAtLeast("3.2.0")) {
  await tgg.setHeaderColor("#18A0FB");
}
await tgg.close();
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

H5 calls native through:

```js
window.flutter_inappwebview.callHandler("nativeBridge", {
  id: "tgg_req_1",
  method: "getUserInfo",
  sdkVersion: "0.1.5",
  timestamp: Date.now(),
});
```

Native responses should use `{ success: true, data }` for success and
`{ success: false, error: { code, message } }` for failures.

The runtime performs local checks before native calls:

- capability and permission checks through `tgg.canIUse(capability)`
- App version checks through `tgg.isVersionAtLeast(version)`
- header color validation for `"bg_color"`, `"secondary_bg_color"`, or `#RRGGBB`
- duplicate `BackButton.show()` / `BackButton.hide()` calls are skipped when the visible state is unchanged

### Back button click events

When the user taps the back button in the navigation bar, the Flutter host should
notify the JS runtime by calling `window.__tgg_emit("backButtonClicked")`.
This is a host-only runtime entrypoint. The SDK's
`BackButton.onClick(cb)` handlers will fire in response:

```dart
// Flutter, on back button tap
controller.evaluateJavascript(
  source: 'window.__tgg_emit("backButtonClicked")',
);
```

See the [BackButton event example](#mini-app-usage) above for the developer-side
usage.

For generic runtime events, miniapps can use:

```ts
tgg.onEvent("themeChanged", (payload) => {
  console.log(payload);
});
```

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
