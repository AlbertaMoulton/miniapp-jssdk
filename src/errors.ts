import type { MiniAppNativeError, MiniAppSDKError } from "./types";

export const createMiniAppError = (message: string, code?: string): MiniAppSDKError => {
  const error = new Error(message) as MiniAppSDKError;
  error.name = "MiniAppSDKError";
  error.code = code;
  return error;
};

export const toMiniAppError = (error: MiniAppNativeError | string): MiniAppSDKError => {
  if (typeof error === "string") {
    return createMiniAppError(error);
  }

  return createMiniAppError(error.message ?? "TeamGaga miniapp bridge request failed", error.code);
};
