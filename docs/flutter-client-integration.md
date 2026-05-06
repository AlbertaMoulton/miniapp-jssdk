# Flutter Client Integration

This document is for the TeamGaga Flutter client. It explains how to inject the
MiniApp runtime and how to implement the native bridge used by H5 miniapps.

## Which JS File To Ship

Use `dist/core.min.js` in production.

- `core.min.js`: production asset, minified runtime injected by Flutter.
- `core.js`: same runtime, unminified, useful for local debugging.
- `index.*.js`: developer-facing SDK bundle. Do not inject it from Flutter.

## Assets

Copy the built runtime into the Flutter app:

```text
assets/miniapp/core.min.js
```

Register it in `pubspec.yaml`:

```yaml
flutter:
  assets:
    - assets/miniapp/core.min.js
```

## WebView Widget

```dart
import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

const String _handlerName = 'nativeBridge';
const String _coreAssetPath = 'assets/miniapp/core.min.js';

class MiniAppWebView extends StatefulWidget {
  const MiniAppWebView({
    super.key,
    required this.initialUrl,
    required this.dispatcher,
    this.onControllerReady,
  });

  final WebUri initialUrl;
  final MiniAppNativeDispatcher dispatcher;
  final ValueChanged<MiniAppWebViewController>? onControllerReady;

  @override
  State<MiniAppWebView> createState() => _MiniAppWebViewState();
}

class _MiniAppWebViewState extends State<MiniAppWebView> {
  late final Future<String> _coreSource;
  MiniAppWebViewController? _miniAppController;

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
            final miniAppController = MiniAppWebViewController(controller);
            _miniAppController = miniAppController;
            widget.onControllerReady?.call(miniAppController);

            controller.addJavaScriptHandler(
              handlerName: _handlerName,
              callback: (args) async {
                return _handleNativeBridgeCall(args);
              },
            );
          },
          onConsoleMessage: (controller, message) {
            debugPrint('[MiniApp console] ${message.messageLevel}: ${message.message}');
          },
          onReceivedError: (controller, request, error) {
            debugPrint('[MiniApp load error] ${request.url}: ${error.description}');
          },
          shouldOverrideUrlLoading: (controller, action) async {
            final uri = action.request.url;
            if (uri == null) {
              return NavigationActionPolicy.CANCEL;
            }

            final isAllowed = uri.scheme == 'https';
            return isAllowed ? NavigationActionPolicy.ALLOW : NavigationActionPolicy.CANCEL;
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
        'error': <String, dynamic>{
          'code': error.code,
          'message': error.message,
        },
      };
    } catch (error, stackTrace) {
      debugPrint('[MiniApp nativeBridge error] $error\n$stackTrace');
      return <String, dynamic>{
        'success': false,
        'error': <String, dynamic>{
          'code': 'INTERNAL_ERROR',
          'message': 'Native bridge error',
        },
      };
    }
  }

  @override
  void dispose() {
    _miniAppController = null;
    super.dispose();
  }
}

class MiniAppWebViewController {
  MiniAppWebViewController(this._controller);

  final InAppWebViewController _controller;

  Future<void> emitBackButtonClicked() {
    return emitEvent('backButtonClicked');
  }

  Future<void> emitThemeChanged({required String colorScheme}) {
    return emitEvent('themeChanged', <String, dynamic>{
      'colorScheme': colorScheme,
    });
  }

  Future<void> emitEvent(String eventName, [Object? payload]) async {
    final eventJson = jsonEncode(eventName);
    final payloadJson = payload == null ? 'undefined' : jsonEncode(payload);
    await _controller.evaluateJavascript(
      source: 'window.__tgg_emit && window.__tgg_emit($eventJson, $payloadJson);',
    );
  }
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
          'viewPadding': <String, dynamic>{
            'left': 0,
            'right': 0,
            'top': 47,
            'bottom': 34,
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

- Register the JavaScript handler before the miniapp starts calling `tgg.init()`.
- Inject `core.min.js` with `UserScriptInjectionTime.AT_DOCUMENT_START`.
- On Android, document-start injection is best effort on older WebView versions.
- Only allow trusted `https` miniapp URLs in production.
- Keep the response envelope stable: `{ success: true, data }` or
  `{ success: false, error: { code, message } }`.
- Do not expose sensitive native capabilities without server-side and native-side
  permission checks.
