import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validReleaseTypes = new Set(["major", "minor", "patch"]);
const [releaseType] = process.argv.slice(2);

if (!validReleaseTypes.has(releaseType)) {
  console.error("Usage: pnpm run release:<major|minor|patch>");
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function output(command, args) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
}

function bumpVersion(version, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    console.error(`Release aborted: unsupported version "${version}".`);
    process.exit(1);
  }

  const next = match.slice(1).map(Number);
  if (type === "major") {
    next[0] += 1;
    next[1] = 0;
    next[2] = 0;
  }
  if (type === "minor") {
    next[1] += 1;
    next[2] = 0;
  }
  if (type === "patch") {
    next[2] += 1;
  }

  return next.join(".");
}

const status = output("git", ["status", "--porcelain"]);
if (status) {
  console.error("Release aborted: git working tree is not clean.");
  process.exit(1);
}

const branch = output("git", ["branch", "--show-current"]);
if (branch !== "main") {
  console.error(`Release aborted: expected branch "main", got "${branch}".`);
  process.exit(1);
}

const packagePath = resolve(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const nextVersion = bumpVersion(packageJson.version, releaseType);
const tagName = `v${nextVersion}`;

try {
  output("git", ["rev-parse", "--verify", tagName]);
  console.error(`Release aborted: tag "${tagName}" already exists.`);
  process.exit(1);
} catch {
  // The tag does not exist, so the release can continue.
}

packageJson.version = nextVersion;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

run("pnpm", ["run", "ready"]);
run("pnpm", ["pack", "--dry-run"]);

run("git", ["add", "package.json"]);
run("git", ["commit", "-m", `release: ${tagName}`]);
run("git", ["tag", tagName]);

console.log(`Release ${tagName} is ready. Push it with: git push origin main ${tagName}`);
