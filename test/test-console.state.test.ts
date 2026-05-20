import { describe, expect, test } from "vite-plus/test";

import {
  buildCallRecord,
  buildEnvironmentDiff,
  buildEnvironmentSnapshot,
  collectCssVariables,
  createLogEntry,
} from "../test/test-console/state.js";

describe("buildEnvironmentSnapshot", () => {
  test("captures init data and runtime getters into a comparable shape", () => {
    const snapshot = buildEnvironmentSnapshot({
      initData: {
        appVersion: "3.4.0",
        sdkVersion: "0.2.0",
        colorScheme: "dark",
        platform: "ios",
      },
      runtime: {
        appVersion: "3.4.0",
        sdkVersion: "0.2.0",
        colorScheme: "dark",
        platform: "ios",
      },
    });

    expect(snapshot.initData?.appVersion).toBe("3.4.0");
    expect(snapshot.runtime?.platform).toBe("ios");
  });
});

describe("buildEnvironmentDiff", () => {
  test("marks fields whose init and runtime values differ", () => {
    expect(
      buildEnvironmentDiff({
        initData: { appVersion: "3.4.0" },
        runtime: { appVersion: "3.5.0" },
      }),
    ).toEqual([
      {
        field: "appVersion",
        initValue: "3.4.0",
        runtimeValue: "3.5.0",
      },
    ]);
  });

  test("treats semantically equal object fields with different key order as unchanged", () => {
    expect(
      buildEnvironmentDiff({
        initData: {
          launchContext: {
            scene: "community",
            communityId: "community-123",
          },
        },
        runtime: {
          launchContext: {
            communityId: "community-123",
            scene: "community",
          },
        },
      }),
    ).toEqual([]);
  });
});

describe("buildCallRecord", () => {
  test("computes duration and preserves error payloads", () => {
    const record = buildCallRecord({
      name: "ready",
      startedAt: 100,
      finishedAt: 140,
      status: "error",
      error: { code: "FAIL", message: "boom" },
    });

    expect(record).toMatchObject({
      name: "ready",
      durationMs: 40,
      status: "error",
      error: { code: "FAIL", message: "boom" },
    });
  });

  test("returns null duration when timing input is invalid", () => {
    expect(
      buildCallRecord({
        name: "ready",
        finishedAt: 140,
        status: "error",
        error: { code: "FAIL", message: "boom" },
      }),
    ).toMatchObject({
      name: "ready",
      durationMs: null,
      status: "error",
      error: { code: "FAIL", message: "boom" },
    });
  });
});

describe("createLogEntry", () => {
  test("adds a timestamp and log level", () => {
    expect(
      createLogEntry({
        source: "api",
        level: "info",
        message: "init ok",
      }),
    ).toMatchObject({
      source: "api",
      level: "info",
      message: "init ok",
    });
  });
});

describe("collectCssVariables", () => {
  test("reads known tgg variables from computed style", () => {
    const variables = collectCssVariables({
      getPropertyValue(name) {
        if (name === "--tgg-color-scheme") return "dark";
        if (name === "--tgg-viewport-height") return "812px";
        return "";
      },
    });

    expect(variables["--tgg-color-scheme"]).toBe("dark");
    expect(variables["--tgg-viewport-height"]).toBe("812px");
  });
});
