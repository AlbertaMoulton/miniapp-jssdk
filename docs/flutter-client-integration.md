# Flutter Client Integration

This document is for the TeamGaga Flutter client. It explains how to inject the
MiniApp runtime and how to implement the native bridge used by H5 miniapps.

## Platform Matrix

Use different WebView integrations per platform:

- iOS / Android: `webview_flutter`
- Windows / macOS: `flutter_inappwebview`
- Flutter Web: not implemented yet

## Which JS File To Ship

Use `dist/core.min.js` in production.

- `core.min.js`: production asset, minified runtime injected by Flutter.
- `core.js`: same runtime, unminified, useful for local debugging.
- `index.*.js`: developer-facing SDK bundle. Do not inject it from Flutter.

## Assets

Copy the built runtime into the Flutter app:

```text
assets/js/core.min.js
```

Register it in `pubspec.yaml`:

```yaml
flutter:
  assets:
    - assets/js/core.min.js
```

## WebView Widget

The SDK supports two native bridge paths:

- `window.nativeBridge.postMessage(...)` for `webview_flutter`
- `window.flutter_inappwebview.callHandler(...)` for `flutter_inappwebview`

Choose the widget implementation by platform.

### iOS / Android (`webview_flutter`)

`webview_flutter` can support the SDK bridge path, but it does **not** offer the
same document-start injection model as `flutter_inappwebview`.

Because of that, the mobile integration should be treated as a **host-controlled
bootstrap flow**, not as “load any remote miniapp URL directly and inject later”.

Recommended constraints for iOS / Android:

- Attach the `nativeBridge` JavaScript channel before loading miniapp content.
- Keep the runtime install and the miniapp page in the **same document lifecycle**.
- Do not rely on `loadHtmlString(...)` followed by `location.replace(...)` to carry
  `window.tgg` into the target page. That creates a new document and loses the
  previously installed runtime.
- Prefer an app-controlled shell page or other host-controlled entry flow that
  guarantees `core.min.js` runs before the miniapp code needs `window.tgg`.

The safe part to mirror from the SDK implementation is the bridge contract:

- JS sends requests through `window.nativeBridge.postMessage(JSON.stringify(request))`
- Flutter resolves them through `window.__tgg_resolve(id, envelope)`

Use a widget structure that bootstraps once and avoids rebuild-driven reloads:

```dart
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String _channelName = 'nativeBridge';

class MiniAppWebView extends StatefulWidget {
  const MiniAppWebView({
    super.key,
    required this.dispatcher,
    required this.loadMiniApp,
  });

  final MiniAppNativeDispatcher dispatcher;
  final Future<void> Function(WebViewController controller) loadMiniApp;

  @override
  State<MiniAppWebView> createState() => _MiniAppWebViewState();
}

class _MiniAppWebViewState extends State<MiniAppWebView> {
  late final WebViewController _controller;
  late final Future<void> _bootstrapFuture;

  @override
  void initState() {
    super.initState();
    _controller =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..addJavaScriptChannel(
            _channelName,
            onMessageReceived: (message) async {
              await _handleNativeBridgeCall(message.message);
            },
          )
          ..setNavigationDelegate(
            NavigationDelegate(
              onWebResourceError: (error) {
                debugPrint('[MiniApp load error] ${error.description}');
              },
              onNavigationRequest: (request) {
                final uri = Uri.tryParse(request.url);
                final isAllowed = uri?.scheme == 'https';
                return isAllowed == true
                    ? NavigationDecision.navigate
                    : NavigationDecision.prevent;
              },
            ),
          );
    _bootstrapFuture = widget.loadMiniApp(_controller);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ColoredBox(
            color: Colors.white,
            child: Center(child: CircularProgressIndicator()),
          );
        }

        return WebViewWidget(controller: _controller);
      },
    );
  }

  Future<void> _handleNativeBridgeCall(String message) async {
    final request = MiniAppInvokeRequest.fromJavaScriptMessage(message);

    try {
      final data = await widget.dispatcher.dispatch(request);
      await _resolveRequest(
        request.id,
        <String, dynamic>{'success': true, 'data': data},
      );
    } on MiniAppNativeException catch (error) {
      await _resolveRequest(request.id, <String, dynamic>{
        'success': false,
        'error': <String, dynamic>{'code': error.code, 'message': error.message},
      });
    } catch (error, stackTrace) {
      debugPrint('[MiniApp nativeBridge error] $error\n$stackTrace');
      await _resolveRequest(request.id, <String, dynamic>{
        'success': false,
        'error': <String, dynamic>{
          'code': 'INTERNAL_ERROR',
          'message': 'Native bridge error',
        },
      });
    }
  }

  Future<void> _resolveRequest(String id, Map<String, dynamic> envelope) async {
    final idJson = jsonEncode(id);
    final envelopeJson = jsonEncode(envelope);
    await _controller.runJavaScript(
      'window.__tgg_resolve && window.__tgg_resolve($idJson, $envelopeJson);',
    );
  }
}

class MiniAppWebViewController {
  MiniAppWebViewController(this._controller);

  final WebViewController _controller;

  Future<void> emitBackButtonClicked() {
    return emitEvent('back_button_clicked');
  }

  Future<void> emitThemeChanged({required String colorScheme}) {
    return emitEvent('theme_changed', <String, dynamic>{
      'colorScheme': colorScheme,
    });
  }

  Future<void> emitEvent(String eventName, [Object? payload]) async {
    final eventJson = jsonEncode(eventName);
    final payloadJson = payload == null ? 'undefined' : jsonEncode(payload);
    await _controller.runJavaScript('''
window.__tgg_emit && window.__tgg_emit($eventJson, $payloadJson);
''');
  }
}
```

Notes:

- `webview_flutter` uses the `nativeBridge.postMessage(...)` path.
- `_bootstrapFuture` is created once in `initState()`, so rebuilds do not reload the miniapp.
- The exact `loadMiniApp()` implementation is app-specific. The important rule is that the
  runtime install and the miniapp code must share the same document lifecycle.
- Flutter Web is not covered by this flow yet.

Recommended mobile shell shape:

1. Flutter loads a host-controlled shell document instead of navigating directly to the remote miniapp URL.
2. The shell document installs `core.min.js` and exposes `window.nativeBridge`.
3. The shell document then mounts the remote miniapp entry inside the same document lifecycle.
4. Miniapp business code starts only after `window.tgg` is already available.

A simple way to organize that is:

```text
Flutter WebView
-> load host-controlled shell URL
-> shell installs core.min.js
-> shell fetches / mounts miniapp content
-> miniapp calls window.tgg.*
```

This shell can be:

- a local HTML asset served by the app
- a host-controlled remote HTML page
- another app-owned entry document that hydrates the miniapp inside it

The key invariant is the same in all cases: do not switch to a second document after installing the runtime.

### Recommended `loadMiniApp()` shape

For mobile, `loadMiniApp()` should load one shell document that:

- installs `core.min.js`
- keeps `window.nativeBridge` available
- mounts miniapp content inside the same page

One practical shape is:

```dart
Future<void> loadMiniApp(
  WebViewController controller,
  String coreSource,
  Uri miniAppManifestUrl,
) async {
  final shellHtml = '''
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      $coreSource
    </script>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #fff;
      }
      #miniapp-root {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="miniapp-root"></div>
    <script>
      (async function () {
        const response = await fetch(${jsonEncode(miniAppManifestUrl.toString())}, {
          credentials: 'include',
        });
        const manifest = await response.json();

        const root = document.getElementById('miniapp-root');
        if (root) {
          if (manifest.cssUrl) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = manifest.cssUrl;
            document.head.appendChild(link);
          }

          if (manifest.html) {
            root.innerHTML = manifest.html;
          }

          if (manifest.jsUrl) {
            const script = document.createElement('script');
            script.src = manifest.jsUrl;
            script.defer = true;
            document.body.appendChild(script);
          }
        }
      })().catch((error) => {
        console.error('[MiniApp shell] failed to load miniapp manifest', error);
      });
    </script>
  </body>
</html>
''';

  await controller.loadHtmlString(shellHtml);
}
```

This is only a reference shape. Your app may instead:

- fetch a miniapp manifest and inject HTML/CSS/JS into a root container
- mount a host-controlled micro-frontend wrapper
- use another same-document shell strategy

The important part is not the exact rendering technique. The important part is:

- `core.min.js` must be installed before miniapp business code needs `window.tgg`
- the bridge must stay in the same document lifecycle
- Flutter must keep resolving native responses through `window.__tgg_resolve(...)`

### Recommended mobile mount protocol

For iOS / Android, a manifest-style mount protocol is the safest default.

Recommended manifest shape:

```json
{
  "html": "<div id=\"app\"></div>",
  "cssUrl": "https://miniapp.example.com/assets/app.css",
  "jsUrl": "https://miniapp.example.com/assets/app.js"
}
```

Recommended responsibilities:

- Flutter:
  - loads the shell document once
  - exposes `nativeBridge`
  - resolves `window.__tgg_resolve(...)`
- Shell document:
  - installs `core.min.js`
  - fetches the miniapp manifest
  - mounts HTML into a known root container
  - appends CSS and JS assets in order
- Miniapp bundle:
  - assumes `window.tgg` already exists
  - hydrates the provided root container
  - does not try to replace the whole document

Why this protocol is safer than “fetch raw HTML and replace the page”:

- avoids cross-document runtime loss
- keeps asset loading explicit
- works better with relative resource planning and CSP
- makes host/miniapp responsibilities easier to debug

### Recommended widget wiring

The widget above becomes easier to reason about if `loadMiniApp()` is passed in
from a host integration layer:

```dart
class TeamGagaMobileMiniAppPage extends StatelessWidget {
  const TeamGagaMobileMiniAppPage({
    super.key,
    required this.miniAppManifestUrl,
    required this.dispatcher,
  });

  final Uri miniAppManifestUrl;
  final MiniAppNativeDispatcher dispatcher;

  @override
  Widget build(BuildContext context) {
    return MiniAppWebView(
      dispatcher: dispatcher,
      loadMiniApp: (controller) async {
        final coreSource = await rootBundle.loadString('assets/js/core.min.js');
        await loadMiniApp(controller, coreSource, miniAppManifestUrl);
      },
    );
  }
}
```

### Windows / macOS (`flutter_inappwebview`)

```dart
import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

const String _handlerName = 'nativeBridge';
const String _coreAssetPath = 'assets/js/core.min.js';

class MiniAppDesktopWebView extends StatefulWidget {
  const MiniAppDesktopWebView({
    super.key,
    required this.initialUrl,
    required this.dispatcher,
    this.onControllerReady,
  });

  final WebUri initialUrl;
  final MiniAppNativeDispatcher dispatcher;
  final ValueChanged<MiniAppDesktopWebViewController>? onControllerReady;

  @override
  State<MiniAppDesktopWebView> createState() => _MiniAppDesktopWebViewState();
}

class _MiniAppDesktopWebViewState extends State<MiniAppDesktopWebView> {
  late final Future<String> _coreSource;
  MiniAppDesktopWebViewController? _miniAppController;

  @override
  void initState() {
    super.initState();
    _coreSource = rootBundle.loadString(_coreAssetPath);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _coreSource,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const ColoredBox(
            color: Colors.white,
            child: Center(child: CircularProgressIndicator()),
          );
        }

        return InAppWebView(
          initialUrlRequest: URLRequest(url: widget.initialUrl),
          initialSettings: InAppWebViewSettings(
            javaScriptEnabled: true,
            transparentBackground: false,
            mediaPlaybackRequiresUserGesture: false,
            useShouldOverrideUrlLoading: true,
          ),
          initialUserScripts: UnmodifiableListView<UserScript>([
            UserScript(
              source: snapshot.data!,
              injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
              forMainFrameOnly: true,
            ),
          ]),
          onWebViewCreated: (controller) {
            final miniAppController = MiniAppDesktopWebViewController(controller);
            _miniAppController = miniAppController;
            widget.onControllerReady?.call(miniAppController);

            controller.addJavaScriptHandler(
              handlerName: _handlerName,
              callback: (args) async {
                return _handleNativeBridgeCall(args);
              },
            );
          },
        );
      },
    );
  }

  Future<Map<String, dynamic>> _handleNativeBridgeCall(List<dynamic> args) async {
    try {
      final request = MiniAppInvokeRequest.fromJavaScriptArgs(args);
      final data = await widget.dispatcher.dispatch(request);
      return <String, dynamic>{'success': true, 'data': data};
    } on MiniAppNativeException catch (error) {
      return <String, dynamic>{
        'success': false,
        'error': <String, dynamic>{'code': error.code, 'message': error.message},
      };
    }
  }
}

class MiniAppDesktopWebViewController {
  MiniAppDesktopWebViewController(this._controller);

  final InAppWebViewController _controller;
}
```

## Native Dispatcher

```dart
abstract interface class MiniAppNativeDispatcher {
  Future<Object?> dispatch(MiniAppInvokeRequest request);
}

class MiniAppInvokeRequest {
  MiniAppInvokeRequest({
    required this.id,
    required this.method,
    required this.sdkVersion,
    required this.timestamp,
    required this.params,
  });

  final String id;
  final String method;
  final String sdkVersion;
  final int timestamp;
  final Map<String, dynamic> params;

  static MiniAppInvokeRequest fromJavaScriptArgs(List<dynamic> args) {
    if (args.isEmpty || args.first is! Map) {
      throw const MiniAppNativeException(
        code: 'INVALID_REQUEST',
        message: 'nativeBridge expects one request object',
      );
    }

    final raw = Map<String, dynamic>.from(args.first as Map);
    final method = raw['method'];
    if (method is! String || method.isEmpty) {
      throw const MiniAppNativeException(
        code: 'INVALID_METHOD',
        message: 'method is required',
      );
    }

    final params = raw['params'];
    return MiniAppInvokeRequest(
      id: raw['id'] as String? ?? '',
      method: method,
      sdkVersion: raw['sdkVersion'] as String? ?? '',
      timestamp: raw['timestamp'] is int ? raw['timestamp'] as int : 0,
      params: params is Map ? Map<String, dynamic>.from(params) : <String, dynamic>{},
    );
  }

  static MiniAppInvokeRequest fromJavaScriptMessage(String message) {
    final raw = jsonDecode(message);
    if (raw is! Map) {
      throw const MiniAppNativeException(
        code: 'INVALID_REQUEST',
        message: 'nativeBridge expects one JSON request object',
      );
    }

    return MiniAppInvokeRequest.fromJavaScriptArgs([raw]);
  }
}

class MiniAppNativeException implements Exception {
  const MiniAppNativeException({
    required this.code,
    required this.message,
  });

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}
```

## Example Dispatcher

Replace the placeholder methods with real app services.

```dart
class TeamGagaMiniAppDispatcher implements MiniAppNativeDispatcher {
  @override
  Future<Object?> dispatch(MiniAppInvokeRequest request) async {
    switch (request.method) {
      case 'init':
        return <String, dynamic>{
          'appVersion': '3.2.0',
          'sdkVersion': request.sdkVersion,
          'colorScheme': 'light',
          'platform': defaultTargetPlatform.name,
          'themeParams': <String, dynamic>{
            'bg_color': '#ffffff',
            'secondary_bg_color': '#f5f5f5',
          },
          'viewportHeight': 720.0,
          'viewportStableHeight': 688.0,
          'headerColor': '#ffffff',
          'backgroundColor': '#ffffff',
          'isFullscreen': false,
          'safeAreaInset': <String, dynamic>{
            'top': 47.0,
            'right': 0.0,
            'bottom': 34.0,
            'left': 0.0,
          },
          'contentSafeAreaInset': <String, dynamic>{
            'top': 0.0,
            'right': 0.0,
            'bottom': 16.0,
            'left': 0.0,
          },
          'launchContext': <String, dynamic>{},
        };
      case 'ready':
        return null;
      case 'close':
        // Close the current miniapp route here.
        return null;
      case 'setHeaderColor':
        final color = request.params['color'];
        if (color is! String) {
          throw const MiniAppNativeException(
            code: 'INVALID_PARAMS',
            message: 'color is required',
          );
        }
        // Apply native navigation bar color here.
        return null;
      case 'BackButton.show':
        // Show native back button.
        return null;
      case 'BackButton.hide':
        // Hide native back button.
        return null;
      case 'getUserId':
        return 'current-user-id';
      case 'getUserInfo':
        return <String, dynamic>{
          'userId': 'current-user-id',
          'avatar': '',
          'username': 'alice',
          'nickname': 'Alice',
        };
      case 'getSystemInfo':
        return <String, dynamic>{
          'devicePixelRatio': 3.0,
          'textScaleFactor': 1.0,
          'locale': <String, dynamic>{
            'countryCode': 'CN',
            'languageCode': 'zh',
          },
          'physicalSize': <String, dynamic>{
            'width': 1170,
            'height': 2532,
          },
          'platformBrightness': 'light',
          'themeParams': <String, dynamic>{
            'bg_color': '#ffffff',
            'secondary_bg_color': '#f5f5f5',
          },
          'viewportHeight': 720.0,
          'viewportStableHeight': 688.0,
          'headerColor': '#ffffff',
          'backgroundColor': '#ffffff',
          'isFullscreen': false,
          'viewPadding': <String, dynamic>{
            'left': 0,
            'right': 0,
            'top': 47,
            'bottom': 34,
          },
          'safeAreaInset': <String, dynamic>{
            'left': 0.0,
            'right': 0.0,
            'top': 47.0,
            'bottom': 34.0,
          },
          'contentSafeAreaInset': <String, dynamic>{
            'left': 0.0,
            'right': 0.0,
            'top': 0.0,
            'bottom': 16.0,
          },
        };
      case 'getOauthCode':
      case 'getCommunityId':
      case 'getCommunityInfo':
        throw const MiniAppNativeException(
          code: 'NOT_IMPLEMENTED',
          message: 'Method is not implemented',
        );
      default:
        throw MiniAppNativeException(
          code: 'UNKNOWN_METHOD',
          message: 'Unknown miniapp method: ${request.method}',
        );
    }
  }
}
```

## Production Notes

- iOS / Android: use the `webview_flutter` `nativeBridge.postMessage(...)` path and resolve requests through `window.__tgg_resolve(...)`.
- Windows / macOS: register the `flutter_inappwebview` JavaScript handler before the miniapp starts calling `tgg.init()`.
- Windows / macOS: inject `core.min.js` with `UserScriptInjectionTime.AT_DOCUMENT_START`.
- iOS / Android: because `webview_flutter` does not use the same document-start user-script model, keep the bootstrap HTML shell so the runtime is installed before the miniapp URL executes.
- Flutter Web is not implemented yet.
- Only allow trusted `https` miniapp URLs in production.
- Keep the response envelope stable: `{ success: true, data }` or
  `{ success: false, error: { code, message } }`.
- Do not expose sensitive native capabilities without server-side and native-side
  permission checks.

## Runtime Environment Sync

The current runtime tracks a Telegram-style environment model. Flutter should keep
these fields current in both the `init` response and any later host events:

- `colorScheme`
- `themeParams`
- `viewportHeight`
- `viewportStableHeight`
- `headerColor`
- `backgroundColor`
- `isFullscreen`
- `safeAreaInset`
- `contentSafeAreaInset`

When any of them change after startup, emit host events through `window.__tgg_emit(...)`:

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("theme_changed", {"colorScheme":"dark","themeParams":{"bg_color":"#101010"},"headerColor":"#123456","backgroundColor":"#654321"})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("viewport_changed", {"height":720,"stableHeight":688})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("safe_area_changed", {"top":47,"right":0,"bottom":34,"left":0})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("content_safe_area_changed", {"top":0,"right":0,"bottom":16,"left":0})',
);
controller.evaluateJavascript(
  source: 'window.__tgg_emit("fullscreen_changed", {"isFullscreen":true})',
);
```

The runtime will expose the same values on `window.tgg` and mirror them into CSS
custom properties using the `--tgg-*` prefix:

- `--tgg-color-scheme`
- `--tgg-theme-*`
- `--tgg-viewport-height`
- `--tgg-viewport-stable-height`
- `--tgg-header-color`
- `--tgg-background-color`
- `--tgg-is-fullscreen`
- `--tgg-safe-area-inset-*`
- `--tgg-content-safe-area-inset-*`
