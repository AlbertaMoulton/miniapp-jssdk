import { installTggRuntime } from "./core-runtime";

export { createTggRuntime, getSupportedCapabilities, installTggRuntime } from "./core-runtime";
export type { TggRuntimeOptions, TggWebApp } from "./types";

installTggRuntime();
