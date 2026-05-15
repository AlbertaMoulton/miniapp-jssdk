import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(rootDir, "package.json");
const constantsPath = resolve(rootDir, "src/constants.ts");

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const constantsSource = readFileSync(constantsPath, "utf8");
const nextSource = constantsSource.replace(
  /export const SDK_VERSION = "[^"]+";/,
  `export const SDK_VERSION = "${packageJson.version}";`,
);

if (nextSource !== constantsSource) {
  writeFileSync(constantsPath, nextSource);
}
