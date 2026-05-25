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
  {
    id: "backButtonUnbind",
    group: "lifecycle-ui",
    title: "BackButton.offClick",
    kind: "event-bind",
  },
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
      url: "https://d22wqdtjjmo1wy.cloudfront.net/attachments/74c76736049355d89a30a3ca5f90fbb3.jpg",
    },
  },
  {
    id: "savePhoto",
    group: "device",
    title: "savePhoto",
    kind: "method",
    defaultParams: {
      url: "https://cdn-test.teamgaga.com/attachments/f1p3uesp340-fb14c7dc-a7df-4442-a156-f489fcf59486.jpg",
    },
  },
  {
    id: "saveVideo",
    group: "device",
    title: "saveVideo",
    kind: "method",
    defaultParams: {
      url: "https://d22wqdtjjmo1wy.cloudfront.net/attachments/4d9e1e7737e2d05cb38558d6f742024b.mp4",
    },
  },
  { id: "activated", group: "lifecycle-ui", title: "activated", kind: "event" },
  { id: "deactivated", group: "lifecycle-ui", title: "deactivated", kind: "event" },
  { id: "theme_changed", group: "device", title: "theme_changed", kind: "event" },
  { id: "viewport_changed", group: "device", title: "viewport_changed", kind: "event" },
  { id: "safe_area_changed", group: "device", title: "safe_area_changed", kind: "event" },
  {
    id: "content_safe_area_changed",
    group: "device",
    title: "content_safe_area_changed",
    kind: "event",
  },
  { id: "fullscreen_failed", group: "device", title: "fullscreen_failed", kind: "event" },
  {
    id: "clipboard_text_received",
    group: "device",
    title: "clipboard_text_received",
    kind: "event",
  },
];
