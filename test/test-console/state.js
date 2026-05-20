const ENVIRONMENT_FIELDS = [
  "appVersion",
  "sdkVersion",
  "colorScheme",
  "platform",
  "viewportHeight",
  "viewportStableHeight",
  "headerColor",
  "backgroundColor",
  "isFullscreen",
  "safeAreaInset",
  "contentSafeAreaInset",
  "launchContext",
];

const CSS_VARIABLE_NAMES = [
  "--tgg-color-scheme",
  "--tgg-viewport-height",
  "--tgg-viewport-stable-height",
  "--tgg-header-color",
  "--tgg-background-color",
  "--tgg-is-fullscreen",
  "--tgg-safe-area-inset-top",
  "--tgg-safe-area-inset-right",
  "--tgg-safe-area-inset-bottom",
  "--tgg-safe-area-inset-left",
  "--tgg-content-safe-area-inset-top",
  "--tgg-content-safe-area-inset-right",
  "--tgg-content-safe-area-inset-bottom",
  "--tgg-content-safe-area-inset-left",
];

const normalizeComparableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeComparableValue(nestedValue)]),
    );
  }

  return value;
};

const areComparableValuesEqual = (leftValue, rightValue) =>
  JSON.stringify(normalizeComparableValue(leftValue)) ===
  JSON.stringify(normalizeComparableValue(rightValue));

export const buildEnvironmentSnapshot = ({
  initData,
  runtime,
  transport,
  injected,
  initError,
}) => ({
  injected,
  transport,
  initError: initError ?? null,
  initData: initData ?? null,
  runtime: runtime ?? null,
});

export const buildEnvironmentDiff = ({ initData, runtime }) =>
  ENVIRONMENT_FIELDS.flatMap((field) => {
    const initValue = initData?.[field] ?? null;
    const runtimeValue = runtime?.[field] ?? null;

    return areComparableValuesEqual(initValue, runtimeValue)
      ? []
      : [{ field, initValue, runtimeValue }];
  });

export const buildCallRecord = ({
  name,
  params,
  startedAt,
  finishedAt,
  status,
  result,
  error,
}) => {
  const hasValidTiming = Number.isFinite(startedAt) && Number.isFinite(finishedAt);

  return {
    name,
    params: params ?? null,
    startedAt,
    finishedAt,
    durationMs: hasValidTiming ? Math.max(0, finishedAt - startedAt) : null,
    status,
    result: result ?? null,
    error: error ?? null,
  };
};

export const createLogEntry = ({ source, level, message, detail }) => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  source,
  level,
  message,
  detail: detail ?? null,
});

export const collectCssVariables = (style) =>
  Object.fromEntries(CSS_VARIABLE_NAMES.map((name) => [name, style.getPropertyValue(name).trim()]));
