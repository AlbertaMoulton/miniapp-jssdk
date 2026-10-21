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

## Test Console

For real-device TeamGaga validation, open the deployed GitHub Pages URL directly inside the TeamGaga App WebView:

**Online Test Console**: [https://albertamoulton.github.io/miniapp-jssdk/](https://albertamoulton.github.io/miniapp-jssdk/)

The test console is automatically built with Vite and deployed to GitHub Pages via GitHub Actions on every push to `main`.

### Local Development & Build

```sh
# Start Vite development server for Test Console
pnpm run dev:pages

# Build Test Console SPA into dist-pages/
pnpm run build:pages
```

Open [http://localhost:5173/](http://localhost:5173/).

The console is designed to degrade safely in a normal browser:

- if `window.tgg` is not injected, the environment panel shows the missing-runtime state
- API controls stay visible but disabled when the runtime capability is unavailable
- the CSS variable and safe-area sections still render for local layout work

Key files:

- `index.html`: standalone test-console entry page
- `test/test-console/index.js`: bootstrap, runtime detection, event wiring, and execution flow
- `test/test-console/dom.js`: rendering helpers for panels and controls
- `test/test-console/state.js`: pure snapshot, log, and CSS-variable helpers

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
console.log(initData.viewportHeight, initData.safeAreaInset?.bottom);

// Fetch data and render the miniapp UI.
await tgg.setHeaderColor("#18A0FB");
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

Open the native community invitation dialog:

```ts
await tgg.openInviteDialog({
  communityId: "79518440989134848",
  // channelId: "target-text-channel-id",
  invitationLink:
    "https://bot-test.teamgaga.com/activity/centers/304926390032011264?communityId=79518440989134848&ic={ic}",
});
```

`openInviteDialog(args: { communityId: string; channelId?: string; invitationLink?: string }): Promise<void>`
opens the dialog for the requested community, independently of the MiniApp's launch context.
Without `channelId`, the host chooses the community's welcome text channel, then its first
public text channel. An explicitly supplied channel must be an available text channel in
that community; invalid targets reject with `INVALID_INVITE_CONTEXT` instead of falling back.

Without `invitationLink`, the host uses its default invitation URL. A supplied link must be
an absolute HTTP/HTTPS URL; invalid options reject with `INVALID_INVITE_OPTIONS`.
The host replaces only search parameters named `ic` whose complete decoded value is `{ic}`
(including `%7Bic%7D`), using the actual invitation code for the selected channel.
All matching occurrences are replaced; existing codes, other parameters and fragments are
preserved. Missing `ic` parameters are not added. The resulting link is used for display,
copying, invitations to friends or group chats, external sharing and QR codes.

The Promise resolves once the host requests the dialog to open after validating the options
and target. It does not wait for rendering or dismissal, or indicate that an invitation was
sent. Later UI errors are logged by the host. `openShare` is removed.
The SDK forwards options to the host; it does not generate invitation codes.

Download a file with progress:

```ts
const task = tgg.downloadFile({
  url: "https://example.com/report.pdf",
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

Save remote media to the system album:

```ts
const saved = await tgg.saveMediaToAlbum({
  url: "https://example.com/media.jpg",
});
console.log(saved);
```

Read clipboard text from the Flutter host:

```ts
const { data } = await tgg.readTextFromClipboard();
console.log(data);
```

Listen for clipboard text returned by the Flutter host:

```ts
const onClipboard = ({ data }: { data: string | null }) => {
  console.log(data);
};

tgg.onEvent("clipboard_text_received", onClipboard);
tgg.offEvent("clipboard_text_received", onClipboard);
```

Listen for Telegram-style environment changes:

```ts
const handleThemeChanged = () => {
  console.log(tgg.colorScheme);
};

const handleViewportChanged = () => {
  console.log(tgg.viewportHeight, tgg.viewportStableHeight);
};

tgg.onEvent("theme_changed", handleThemeChanged);
tgg.onEvent("viewport_changed", handleViewportChanged);

tgg.offEvent("theme_changed", handleThemeChanged);
tgg.offEvent("viewport_changed", handleViewportChanged);
```

For explicit access:

```ts
import { getTgg } from "@teamgaga/miniapp-jssdk";

const runtime = getTgg();
await runtime.getUserInfo();
```

`getTgg()` throws a clear error when the app is not running inside TeamGaga and
`window.tgg` has not been injected.

## Telegram-style environment fields

The injected runtime now mirrors the Telegram Mini Apps style environment model.
After `await tgg.init()`, both `initData` and `window.tgg` expose:

- `version`
- `platform`
- `colorScheme`
- `viewportHeight`
- `viewportStableHeight`
- `isFullscreen`
- `safeAreaInset`
- `contentSafeAreaInset`

Example:

```ts
await tgg.init();

console.log(tgg.version, tgg.platform);
console.log(tgg.viewportHeight, tgg.viewportStableHeight);
console.log(tgg.safeAreaInset.bottom, tgg.contentSafeAreaInset.bottom);
```

The runtime also writes CSS custom properties to `document.documentElement.style`
with a `--tgg-` prefix so H5 can consume host state without waiting on JS glue:

- `--tgg-color-scheme`
- `--tgg-viewport-height`
- `--tgg-viewport-stable-height`
- `--tgg-is-fullscreen`
- `--tgg-safe-area-inset-*`
- `--tgg-content-safe-area-inset-*`

Example:

```css
.page {
  min-height: var(--tgg-viewport-height);
  padding-bottom: var(--tgg-content-safe-area-inset-bottom);
  background: var(--tgg-theme-bg-color, var(--tgg-background-color));
}
```

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
  sdkVersion: "0.1.11",
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
- header color validation for `#RRGGBB`
- duplicate `BackButton.show()` / `BackButton.hide()` calls are skipped when the visible state is unchanged
- file download progress and completion are delivered through `window.__tgg_emit`
- clipboard text results are delivered through `window.__tgg_emit`

### Back button click events

When the user performs a host back action, the Flutter host should first check
whether the MiniApp has registered a back handler. If it has, notify the JS
runtime by calling `window.__tgg_emit("back_button_clicked")`. If it has not,
fall back to the host's default WebView/page navigation behavior.
`window.__tgg_emit` and `window.__tgg_has_event_handlers` are host-only runtime
entrypoints. The SDK's `BackButton.onClick(cb)` handlers will fire in response:

```dart
final handledByMiniApp = await controller.runJavaScriptReturningResult(
  'Boolean(window.__tgg_has_event_handlers && window.__tgg_has_event_handlers("back_button_clicked"))',
);

if (handledByMiniApp == true) {
  await controller.runJavaScript('window.__tgg_emit("back_button_clicked")');
} else if (await controller.canGoBack()) {
  await controller.goBack();
} else {
  // Pop the host page when appropriate.
}
```

See the [BackButton event example](#mini-app-usage) above for the developer-side
usage.

For generic runtime events, miniapps can use:

```ts
tgg.onEvent("theme_changed", (payload) => {
  console.log(payload);
});
```

The host may also emit these environment events when state changes:

- `activated`
- `deactivated`
- `theme_changed`
- `viewport_changed`
- `safe_area_changed`
- `content_safe_area_changed`
- `fullscreen_changed`
- `fullscreen_failed`

Recommended payloads:

```ts
window.__tgg_emit("theme_changed", {
  colorScheme: "dark",
});

window.__tgg_emit("viewport_changed", {
  height: 720,
  stableHeight: 688,
});

window.__tgg_emit("safe_area_changed", {
  top: 44,
  right: 0,
  bottom: 34,
  left: 0,
});

window.__tgg_emit("content_safe_area_changed", {
  top: 0,
  right: 0,
  bottom: 16,
  left: 0,
});

window.__tgg_emit("fullscreen_changed", {
  isFullscreen: true,
});
```

### File download events

Flutter should emit file download task events with the `taskId` provided in the
`downloadFile` request:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("download_file_progress", {"taskId":"tgg_download_1","progress":42})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("download_file_success", {"taskId":"tgg_download_1","tempFilePath":"/tmp/report.pdf"})',
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

H5 can actively request clipboard text with:

```js
await window.tgg.readTextFromClipboard();
```

The host should return a response envelope whose `data` payload looks like:

```json
{ "data": "copied text" }
```

If no clipboard text is available, return `{ "data": null }` or omit `data`.
The SDK will normalize the result to `{ data: null }`.

After `readTextFromClipboard()` resolves, the SDK will also emit
`clipboard_text_received` to any active listeners.

Flutter can return clipboard text to H5 with:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("clipboard_text_received", {"data":"copied text"})',
);
```

If no text is available, emit `{"data":null}` or omit `data`; SDK callbacks will
receive `{ data: null }`.

## Release

### GitHub Pages (Test Console Deployment)

The test console is hosted on GitHub Pages: [https://albertamoulton.github.io/miniapp-jssdk/](https://albertamoulton.github.io/miniapp-jssdk/).

- **Repository Settings (One-time setup)**:
  In the GitHub repository, navigate to **Settings** > **Pages** > **Build and deployment** > **Source**, and select **`GitHub Actions`**.
- **Automated Deployment**:
  Every push to the `main` branch automatically triggers `.github/workflows/deploy-pages.yml`, which compiles the SDK and Test Console SPA into `dist-pages/` and deploys it to GitHub Pages.
- **Manual Deployment**:
  You can also trigger deployment manually from the GitHub web UI: go to **Actions** > **Deploy Test Console to GitHub Pages** > **Run workflow** on branch `main`.

### npm Package Release

Configure npm Trusted Publishing for `@teamgaga/miniapp-jssdk`:

- Publisher: GitHub Actions
- Owner: `AlbertaMoulton`
- Repository: `miniapp-jssdk`
- Workflow filename: `publish.yml`
- `package.json` repository URL: `git+https://github.com/AlbertaMoulton/miniapp-jssdk.git`

If this package was previously published from another repository, update the npm
package's Trusted Publisher settings before the next release. npm allows only
one Trusted Publisher per package, and stale settings from the old repository
will cause GitHub Actions publishes to fail at `npm publish`, often with
`E404`/permission-style errors.

All package releases must go through GitHub Actions. Do not run `npm publish`
locally. The supported release flow is:

1. Update `main` with any workflow or documentation changes needed for the
   release process.
2. Create the release tag from `main`.
3. Push `main` and the new tag to `origin`.
4. Let `.github/workflows/publish.yml` publish the package through npm Trusted
   Publishing.

Create a release tag from `main` with:

```bash
pnpm run release:patch
git push origin main v<version>
```

Replace `<version>` with the tag created by the release script. Use `minor` or `major` when needed. The release script updates `package.json`, runs checks, tests, build, and `pnpm pack --dry-run`, then commits the version bump and creates the tag. GitHub Actions verifies the tag, then publishes the workspace directly to npm with Trusted Publishing.
