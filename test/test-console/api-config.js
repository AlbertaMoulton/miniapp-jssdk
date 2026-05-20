export const API_GROUPS = [
  { id: "lifecycle-ui", title: "Lifecycle & UI API" },
  { id: "business-system", title: "Business & System API" },
  { id: "device", title: "Device API" },
];

export const VERSION_PRESETS = ["1.0.0", "2.0.0", "3.2.0"];

export const HEADER_COLOR_PRESETS = ["bg_color", "secondary_bg_color", "#18A0FB"];

export const API_ITEMS = [
  { id: "init", group: "lifecycle-ui", title: "init", kind: "method" },
  { id: "ready", group: "lifecycle-ui", title: "ready", kind: "method" },
  { id: "close", group: "lifecycle-ui", title: "close", kind: "method" },
  {
    id: "setHeaderColor",
    group: "lifecycle-ui",
    title: "setHeaderColor",
    kind: "method",
    presets: HEADER_COLOR_PRESETS,
    defaultParams: { color: "bg_color" },
  },
  { id: "backButtonShow", group: "lifecycle-ui", title: "BackButton.show", kind: "method" },
  { id: "backButtonHide", group: "lifecycle-ui", title: "BackButton.hide", kind: "method" },
  { id: "backButtonBind", group: "lifecycle-ui", title: "BackButton.onClick", kind: "event-bind" },
  { id: "backButtonUnbind", group: "lifecycle-ui", title: "BackButton.offClick", kind: "event-bind" },
  { id: "getOauthCode", group: "business-system", title: "getOauthCode", kind: "method" },
  { id: "getUserId", group: "business-system", title: "getUserId", kind: "method" },
  { id: "getUserInfo", group: "business-system", title: "getUserInfo", kind: "method" },
  { id: "getSystemInfo", group: "business-system", title: "getSystemInfo", kind: "method" },
  { id: "getCommunityId", group: "business-system", title: "getCommunityId", kind: "method" },
  { id: "getCommunityInfo", group: "business-system", title: "getCommunityInfo", kind: "method" },
  {
    id: "downloadFile",
    group: "device",
    title: "downloadFile",
    kind: "task",
    defaultParams: {
      url: "./test/assets/download-fixture.txt",
      fileName: "teamgaga-test-file.txt",
    },
  },
  {
    id: "saveImageToAlbum",
    group: "device",
    title: "saveImageToAlbum",
    kind: "method",
    defaultParams: {
      fileName: "teamgaga-test-image.png",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    },
  },
  { id: "clipboardTextReceived", group: "device", title: "clipboardTextReceived", kind: "event" },
];
