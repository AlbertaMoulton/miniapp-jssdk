import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("package import entry points to an ESM bundle", async () => {
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
    module?: string;
    exports?: {
      "."?: {
        import?: string;
        default?: string;
      };
      "./core"?: {
        import?: string;
        default?: string;
      };
    };
  };

  expect(packageJson.module).toBe("./dist/index.esm.js");
  expect(packageJson.exports?.["."]?.import).toBe("./dist/index.esm.js");
  expect(packageJson.exports?.["."]?.default).toBe("./dist/index.iife.js");
  expect(packageJson.exports?.["./core"]?.import).toBe("./dist/core.esm.js");
  expect(packageJson.exports?.["./core"]?.default).toBe("./dist/core.js");
});

test("source SDK version matches package version", async () => {
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
    version: string;
  };
  const constantsSource = await readFile(resolve(packageRoot, "src/constants.ts"), "utf8");
  const versionMatch = constantsSource.match(/export const SDK_VERSION = "([^"]+)";/);

  expect(versionMatch?.[1]).toBe(packageJson.version);
});
