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
    };
  };

  expect(packageJson.module).toBe("./dist/index.esm.js");
  expect(packageJson.exports?.["."]?.import).toBe("./dist/index.esm.js");
  expect(packageJson.exports?.["."]?.default).toBe("./dist/index.iife.js");
});
