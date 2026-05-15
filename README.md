# TeamGaga MiniApp JS SDK

JavaScript SDK for TeamGaga miniapps running inside the TeamGaga App Flutter WebView container.

## Runtime vs SDK

This package now has two surfaces:

- `dist/core.js`: runtime code for Flutter WebView injection. It mounts `window.tgg`, talks to native through either Flutter InAppWebView `callHandler` or webview_flutter `JavaScriptChannel`, handles host events, and exposes Mini App APIs.
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

const initData = await tgg.init();
console.log(initData.platform, initData.colorScheme);

// Fetch data and render the miniapp UI.
await tgg.setHeaderColor("bg_color");
tgg.BackButton.show();
tgg.BackButton.onClick(() => {
  // Custom back navigation
});
if (tgg.canIUse("setHeaderColor") && tgg.isVersionAtLeast("3.2.0")) {
  await tgg.setHeaderColor("#18A0FB");
}

await tgg.ready();
await tgg.close();
```

Download a file with progress:

```ts
const task = tgg.downloadFile({
  url: "https://example.com/report.pdf",
  fileName: "report.pdf",
  success({ tempFilePath }) {
    console.log(tempFilePath);
  },
  fail({ errMsg }) {
    console.error(errMsg);
  },
  complete({ errMsg }) {
    console.log(errMsg);
  },
});

task.onProgressUpdate(({ progress }) => {
  console.log(progress);
});

// Cancel if needed.
task.abort();
```

Save a data URL image to the system album:

```ts
const saved = await tgg.saveImageToAlbum({
  fileName: "aaa.jpg",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAA...",
});
console.log(saved);
```

Listen for clipboard text returned by the Flutter host:

```ts
const offClipboard = tgg.onClipboardTextReceived(({ data }) => {
  console.log(data);
});

// Remove the listener when the page no longer needs it.
offClipboard();
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
  id: "tgg_req_1_1",
  method: "init",
  sdkVersion: "0.1.5",
  timestamp: Date.now(),
});
```

Native responses should use `{ success: true, data }` for success and
`{ success: false, error: { code, message } }` for failures.

For `webview_flutter`, expose a JavaScriptChannel named `nativeBridge`. The SDK
posts `JSON.stringify(request)` through `window.nativeBridge.postMessage(...)`;
the host should respond by evaluating:

```js
window.__tgg_resolve("tgg_req_1_1", {
  success: true,
  data: {},
});
```

If both host transports are available, the SDK uses Flutter InAppWebView.

The runtime performs local checks before native calls:

- capability and permission checks through `tgg.canIUse(capability)`
- App version checks through `tgg.isVersionAtLeast(version)`
- header color validation for `"bg_color"`, `"secondary_bg_color"`, or `#RRGGBB`
- duplicate `BackButton.show()` / `BackButton.hide()` calls are skipped when the visible state is unchanged
- file download progress and completion are delivered through `window.__tgg_emit`
- clipboard text results are delivered through `window.__tgg_emit`

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

### File download events

Flutter should emit file download task events with the `taskId` provided in the
`downloadFile` request:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("downloadFileProgress", {"taskId":"tgg_download_1","progress":42})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("downloadFileSuccess", {"taskId":"tgg_download_1","tempFilePath":"/tmp/report.pdf"})',
);
```

Cancelling a download calls native with:

```js
{
  method: "abortDownloadFile",
  params: { taskId: "tgg_download_1" }
}
```

### Clipboard text events

Flutter can return clipboard text to H5 with:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("clipboardTextReceived", {"data":"copied text"})',
);
```

If no text is available, emit `{"data":null}` or omit `data`; SDK callbacks will
receive `{ data: null }`.

## Release

Configure npm Trusted Publishing for `@teamgaga/miniapp-jssdk`:

- Publisher: GitHub Actions
- Owner: `AlbertaMoulton`
- Repository: `miniapp-jssdk`
- Workflow filename: `publish.yml`

Then create a release tag from `main`:

```bash
pnpm run release:patch
git push origin main v<version>
```

Replace `<version>` with the tag created by the release script. Use `minor` or `major` when needed. The release script updates `package.json`, runs checks, tests, build, and `pnpm pack --dry-run`, then commits the version bump and creates the tag. GitHub Actions verifies the tag, then publishes the workspace directly to npm with Trusted Publishing.
