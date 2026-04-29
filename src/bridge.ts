import { REQUEST_ID_PREFIX } from "./constants";
import { createMiniAppError, toMiniAppError } from "./errors";
import { getRuntimeGlobal } from "./runtime";
import type {
  MiniAppBridge,
  MiniAppMethod,
  MiniAppNativeCallbackPayload,
  MiniAppNativeError,
  MiniAppRequest,
} from "./types";

type PendingRequest = {
  bridge: MiniAppBridge;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
};

type NativeCallbackResult = {
  ok: boolean;
  value: unknown;
};

export type MiniAppBridgeClient = {
  invoke<T>(method: MiniAppMethod): Promise<T>;
  resolve(id: string, value: unknown): void;
  reject(id: string, error: MiniAppNativeError | string): void;
};

export const createBridgeClient = (bridgeName: string): MiniAppBridgeClient => {
  const pendingRequests: Record<string, PendingRequest | undefined> = {};
  let requestSequence = 0;

  const createCallbackId = (): string => {
    requestSequence += 1;
    return `${REQUEST_ID_PREFIX}${requestSequence}`;
  };

  const getBridge = (): MiniAppBridge | undefined => {
    const bridge = getRuntimeGlobal()[bridgeName] as MiniAppBridge | undefined;

    if (!bridge || typeof bridge.postMessage !== "function") {
      return undefined;
    }

    return bridge;
  };

  const cleanup = (id: string): PendingRequest | undefined => {
    const pendingRequest = pendingRequests[id];
    if (!pendingRequest) {
      return undefined;
    }

    delete pendingRequests[id];
    delete pendingRequest.bridge[id];
    return pendingRequest;
  };

  const resolve = (id: string, value: unknown): void => {
    const pendingRequest = cleanup(id);
    if (!pendingRequest) {
      return;
    }

    pendingRequest.resolve(value);
  };

  const reject = (id: string, error: MiniAppNativeError | string): void => {
    const pendingRequest = cleanup(id);
    if (!pendingRequest) {
      return;
    }

    pendingRequest.reject(toMiniAppError(error));
  };

  const settleNativeCallback = (id: string, payload: MiniAppNativeCallbackPayload): void => {
    const result = normalizeNativeCallbackPayload(payload);
    if (result.ok) {
      resolve(id, result.value);
      return;
    }

    reject(id, result.value as MiniAppNativeError | string);
  };

  const registerBridgeCallback = (bridge: MiniAppBridge, id: string): void => {
    bridge[id] = (payload: MiniAppNativeCallbackPayload) => {
      settleNativeCallback(id, payload);
    };
  };

  const invoke = <T>(method: MiniAppMethod): Promise<T> => {
    const bridge = getBridge();

    if (!bridge) {
      return Promise.reject(createMiniAppError("TeamGaga miniapp bridge is unavailable"));
    }

    const request: MiniAppRequest = {
      callback: createCallbackId(),
      api: method,
    };

    return new Promise<T>((resolve, reject) => {
      pendingRequests[request.callback] = {
        bridge,
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      registerBridgeCallback(bridge, request.callback);

      try {
        bridge.postMessage(JSON.stringify(request));
      } catch (error) {
        cleanup(request.callback);
        reject(error);
      }
    });
  };

  return {
    invoke,
    resolve,
    reject,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeNativeCallbackPayload = (
  payload: MiniAppNativeCallbackPayload,
): NativeCallbackResult => {
  const parsedPayload = parseNativeCallbackPayload(payload);

  if (!isRecord(parsedPayload)) {
    return {
      ok: true,
      value: parsedPayload,
    };
  }

  if (parsedPayload.success === false) {
    return {
      ok: false,
      value: parsedPayload.error ?? {
        code: typeof parsedPayload.code === "string" ? parsedPayload.code : undefined,
        message: typeof parsedPayload.message === "string" ? parsedPayload.message : undefined,
      },
    };
  }

  if ("data" in parsedPayload) {
    return {
      ok: true,
      value: parsedPayload.data,
    };
  }

  return {
    ok: true,
    value: parsedPayload,
  };
};

const parseNativeCallbackPayload = (payload: MiniAppNativeCallbackPayload): unknown => {
  if (typeof payload !== "string") {
    return payload;
  }

  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
};
