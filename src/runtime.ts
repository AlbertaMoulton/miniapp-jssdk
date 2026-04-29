export const getRuntimeGlobal = (): Record<string, unknown> => {
  if (typeof globalThis !== "undefined") {
    return globalThis as Record<string, unknown>;
  }

  if (typeof self !== "undefined") {
    return self as unknown as Record<string, unknown>;
  }

  if (typeof window !== "undefined") {
    return window as unknown as Record<string, unknown>;
  }

  return {};
};
