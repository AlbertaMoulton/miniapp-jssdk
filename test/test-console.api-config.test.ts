import { expect, test } from "vite-plus/test";

import { API_GROUPS, API_ITEMS, VERSION_PRESETS } from "../test/test-console/api-config.js";

test("covers all approved P0 P1 P2 api items", () => {
  expect(API_GROUPS.map((group) => group.id)).toEqual([
    "lifecycle-ui",
    "business-system",
    "device",
  ]);

  expect(API_ITEMS.map((item) => item.id)).toEqual([
    "init",
    "ready",
    "close",
    "setHeaderColor",
    "backButtonShow",
    "backButtonHide",
    "backButtonBind",
    "backButtonUnbind",
    "getOauthCode",
    "getUserId",
    "getUserInfo",
    "getSystemInfo",
    "getCommunityId",
    "getCommunityInfo",
    "downloadFile",
    "savePhoto",
    "saveVideo",
    "clipboardTextReceived",
  ]);
});

test("keeps api item config structurally valid", () => {
  const groupIds = new Set(API_GROUPS.map((group) => group.id));
  const validKinds = new Set(["method", "event-bind", "task", "event"]);

  expect(
    API_GROUPS.every((group) => typeof group.title === "string" && group.title.trim().length > 0),
  ).toBe(true);

  expect(
    API_ITEMS.every(
      (item) =>
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        groupIds.has(item.group) &&
        validKinds.has(item.kind),
    ),
  ).toBe(true);
});

test("provides first-class presets for header color and version checks", () => {
  const headerColor = API_ITEMS.find((item) => item.id === "setHeaderColor");

  expect(headerColor?.presets).toEqual(["bg_color", "secondary_bg_color", "#18A0FB"]);
  expect(VERSION_PRESETS).toEqual(["1.0.0", "2.0.0", "3.2.0"]);
  expect(headerColor?.defaultParams).toEqual({ color: "bg_color" });
});

test("ships click-ready default params for device actions", () => {
  const downloadItem = API_ITEMS.find((item) => item.id === "downloadFile");
  const savePhotoItem = API_ITEMS.find((item) => item.id === "savePhoto");
  const saveVideoItem = API_ITEMS.find((item) => item.id === "saveVideo");

  expect(downloadItem?.defaultParams).toMatchObject({
    url: expect.stringMatching(/^https?:\/\//u),
  });
  expect(savePhotoItem?.defaultParams).toMatchObject({
    url: expect.stringMatching(/^https?:\/\//u),
  });
  expect(saveVideoItem?.defaultParams).toMatchObject({
    url: expect.stringMatching(/^https?:\/\//u),
  });
});
