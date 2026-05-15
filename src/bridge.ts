import {
  DEFAULT_NATIVE_HANDLER_NAME,
  NATIVE_BRIDGE_UNAVAILABLE_MESSAGE,
  REQUEST_ID_PREFIX,
  SDK_VERSION,
} from "./constants";
import { createMiniAppError, toMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  BridgeTransport,
  FlutterInAppWebViewBridge,
  MiniAppInvokeFailureResponse,
  MiniAppInvokeRequest,
  MiniAppInvokeResponse,
  MiniAppMethod,
  MiniAppNativeError,
  WebViewFlutterJavaScriptChannel,
} from "./types";

type MiniAppBridgeClientOptions = {
  handlerName?: string;
  sdkVersion?: string;
};

export type MiniAppBridgeClient = {
  invoke<T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T>;
};

let bridgeClientSequence = 0;

export const createFlutterInAppWebViewTransport = (
  handlerName = DEFAULT_NATIVE_HANDLER_NAME,
): BridgeTransport => ({
  async send<T>(request: MiniAppInvokeRequest): Promise<T> {
    const bridge = getFlutterBridge();

    if (!bridge) {
      throw createMiniAppError(NATIVE_BRIDGE_UNAVAILABLE_MESSAGE);
    }

    const response = await bridge.callHandler(handlerName, request);
    return normalizeNativeResponse<T>(response);
  },
});

export const createWebViewFlutterTransport = (): BridgeTransport => ({
  send<T>(request: MiniAppInvokeRequest): Promise<T> {
    const bridge = getWebViewFlutterBridge();

    if (!bridge) {
      throw createMiniAppError(NATIVE_BRIDGE_UNAVAILABLE_MESSAGE);
    }

    installWebViewFlutterResolver();

    return new Promise<T>((resolve, reject) => {
      pendingWebViewFlutterRequests.set(request.id, { resolve, reject });
      try {
        bridge.postMessage(JSON.stringify(request));
      } catch (error) {
        pendingWebViewFlutterRequests.delete(request.id);
        reject(error);
      }
    });
  },
});

export const createBridgeClient = (
  options: MiniAppBridgeClientOptions = {},
): MiniAppBridgeClient => {
  const flutterTransport = createFlutterInAppWebViewTransport(options.handlerName);
  const webViewFlutterTransport = createWebViewFlutterTransport();
  const sdkVersion = options.sdkVersion ?? SDK_VERSION;
  bridgeClientSequence += 1;
  const clientId = bridgeClientSequence.toString(36);
  let requestSequence = 0;

  const createRequestId = (): string => {
    requestSequence += 1;
    return `${REQUEST_ID_PREFIX}${clientId}_${requestSequence}`;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    const request: MiniAppInvokeRequest = {
      id: createRequestId(),
      method,
      ...(params ? { params } : {}),
      sdkVersion,
      timestamp: Date.now(),
    };

    if (getFlutterBridge()) {
      return flutterTransport.send<T>(request);
    }

    if (getWebViewFlutterBridge()) {
      return webViewFlutterTransport.send<T>(request);
    }

    return Promise.reject(createMiniAppError(NATIVE_BRIDGE_UNAVAILABLE_MESSAGE));
  };

  return { invoke };
};

const getFlutterBridge = (): FlutterInAppWebViewBridge | undefined => {
  const global = getRuntimeGlobal() as typeof globalThis & {
    flutter_inappwebview?: FlutterInAppWebViewBridge;
  };
  const bridge = global.flutter_inappwebview;

  if (!bridge || typeof bridge.callHandler !== "function") {
    return undefined;
  }

  return bridge;
};

const getWebViewFlutterBridge = (): WebViewFlutterJavaScriptChannel | undefined => {
  const global = getRuntimeGlobal() as typeof globalThis & {
    nativeBridge?: WebViewFlutterJavaScriptChannel;
  };
  const bridge = global.nativeBridge;

  if (!bridge || typeof bridge.postMessage !== "function") {
    return undefined;
  }

  return bridge;
};

type PendingWebViewFlutterRequest = {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
};

const pendingWebViewFlutterRequests = new Map<string, PendingWebViewFlutterRequest>();

const installWebViewFlutterResolver = (): void => {
  const global = getRuntimeGlobal() as typeof globalThis & {
    __tgg_resolve?: (id: string, envelope: unknown) => void;
  };

  if (global.__tgg_resolve === resolveWebViewFlutterRequest) {
    return;
  }

  global.__tgg_resolve = resolveWebViewFlutterRequest;
};

const resolveWebViewFlutterRequest = (id: string, envelope: unknown): void => {
  const pendingRequest = pendingWebViewFlutterRequests.get(id);

  if (!pendingRequest) {
    return;
  }

  pendingWebViewFlutterRequests.delete(id);

  try {
    pendingRequest.resolve(normalizeNativeResponse(envelope));
  } catch (error) {
    pendingRequest.reject(error);
  }
};

const normalizeNativeResponse = <T>(response: unknown): T => {
  const parsedResponse = parseNativeResponse(response);

  if (!isRecord(parsedResponse) || !("success" in parsedResponse)) {
    return parsedResponse as T;
  }

  const envelope = parsedResponse as MiniAppInvokeResponse<T>;

  if (envelope.success) {
    return envelope.data as T;
  }

  throw toMiniAppError(getNativeError(envelope));
};

const getNativeError = (response: MiniAppInvokeFailureResponse): MiniAppNativeError | string => {
  if (response.error) {
    return response.error;
  }

  return {
    code: typeof response.code === "string" ? response.code : undefined,
    message: typeof response.message === "string" ? response.message : undefined,
  };
};

const parseNativeResponse = (response: unknown): unknown => {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response) as unknown;
  } catch {
    return response;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
