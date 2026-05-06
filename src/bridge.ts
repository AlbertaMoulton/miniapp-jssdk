import {
  DEFAULT_NATIVE_HANDLER_NAME,
  FLUTTER_BRIDGE_UNAVAILABLE_MESSAGE,
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
} from "./types";

type MiniAppBridgeClientOptions = {
  handlerName?: string;
  sdkVersion?: string;
};

export type MiniAppBridgeClient = {
  invoke<T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T>;
};

export const createFlutterInAppWebViewTransport = (
  handlerName = DEFAULT_NATIVE_HANDLER_NAME,
): BridgeTransport => ({
  async send<T>(request: MiniAppInvokeRequest): Promise<T> {
    const bridge = getFlutterBridge();

    if (!bridge) {
      throw createMiniAppError(FLUTTER_BRIDGE_UNAVAILABLE_MESSAGE);
    }

    const response = await bridge.callHandler(handlerName, request);
    return normalizeNativeResponse<T>(response);
  },
});

export const createBridgeClient = (
  options: MiniAppBridgeClientOptions = {},
): MiniAppBridgeClient => {
  const transport = createFlutterInAppWebViewTransport(options.handlerName);
  const sdkVersion = options.sdkVersion ?? SDK_VERSION;
  let requestSequence = 0;

  const createRequestId = (): string => {
    requestSequence += 1;
    return `${REQUEST_ID_PREFIX}${requestSequence}`;
  };

  const invoke = <T>(method: MiniAppMethod, params?: Record<string, unknown>): Promise<T> => {
    const request: MiniAppInvokeRequest = {
      id: createRequestId(),
      method,
      ...(params ? { params } : {}),
      sdkVersion,
      timestamp: Date.now(),
    };

    return transport.send<T>(request);
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
