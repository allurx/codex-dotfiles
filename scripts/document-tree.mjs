import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "https://github.com/allurx/agent-skills.git";
const revision = "366394174b1acc28a83c0d46b6af66972cd2797e";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "codex/AGENTS.md");
const output = join(root, "dist/index.html");
const cache = join(root, "work/tools", `markdown-tree-view-${revision}`);
const renderer = join(cache, "skills/markdown-tree-view/scripts/markdown-tree-view.mjs");
const manifest = join(root, "work/build-manifest.json");

function git(args) {
  const options = { cwd: cache, encoding: "utf8", windowsHide: true };
  let result = spawnSync("git", args, options);
  if (result.status !== 0 && result.stderr?.includes("detected dubious ownership")) {
    // Trust only this tool checkout, without changing the user's global Git configuration.
    result = spawnSync("git", ["-c", `safe.directory=${cache.replaceAll("\\", "/")}`, ...args], options);
  }
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function ensureRenderer() {
  if (!existsSync(cache)) {
    mkdirSync(dirname(cache), { recursive: true });
    mkdirSync(cache);
    git(["init", "--quiet"]);
    git(["config", "core.autocrlf", "false"]);
    git(["remote", "add", "origin", repository]);
    git(["fetch", "--quiet", "--depth=1", "origin", revision]);
    git(["sparse-checkout", "set", "skills/markdown-tree-view"]);
    git(["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  }

  if (!lstatSync(cache).isDirectory() || !existsSync(join(cache, ".git"))) {
    throw new Error(`Tool cache is not a Git checkout: ${cache}. Inspect it before moving it aside and retrying.`);
  }
  if (git(["remote", "get-url", "origin"]) !== repository || git(["rev-parse", "HEAD"]) !== revision) {
    throw new Error(`Tool cache does not match the pinned repository and revision: ${cache}. No files were overwritten.`);
  }
  if (git(["status", "--porcelain", "--untracked-files=all"])) {
    throw new Error(`Tool cache contains changes: ${cache}. Preserve or resolve them before retrying.`);
  }
  const skillFiles = git(["ls-tree", "-r", "-z", "--name-only", "HEAD", "--", "skills/markdown-tree-view"])
    .split("\0").filter(Boolean);
  if (!skillFiles.length || skillFiles.some((path) => !existsSync(join(cache, path)))) {
    throw new Error(`Tool cache is incomplete: ${cache}. The complete markdown-tree-view Skill directory is required.`);
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verifyDistribution(allowMissing = false) {
  const directory = dirname(output);
  const metadata = lstatSync(directory, { throwIfNoEntry: false });
  if (!metadata && allowMissing) return;
  if (!metadata?.isDirectory()) {
    throw new Error(`Distribution must be a regular directory, not a symlink: ${directory}`);
  }
  const entries = readdirSync(directory, { withFileTypes: true });
  const unexpected = entries.filter((entry) => entry.name !== "index.html" || !entry.isFile());
  if (unexpected.length) {
    throw new Error(`Distribution may contain only a regular index.html file. Inspect these unexpected targets before retrying: ${unexpected.map((entry) => join(directory, entry.name)).join(", ")}`);
  }
  if (!allowMissing && entries.length !== 1) {
    throw new Error(`Distribution is missing its required file: ${output}`);
  }
}

try {
  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error("Node.js 24 or newer is required.");
  }
  const [mode, ...extra] = process.argv.slice(2);
  if (!["build", "check"].includes(mode) || extra.length) {
    throw new Error("Usage: node scripts/document-tree.mjs <build|check>");
  }
  verifyDistribution(mode === "build");
  ensureRenderer();
  const result = spawnSync(process.execPath, [
    renderer, "--input", source, "--output", output, ...(mode === "check" ? ["--check"] : []),
  ], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`Document tree ${mode} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}.`);
  }
  verifyDistribution();
  if (mode === "build") {
    writeFileSync(manifest, `${JSON.stringify({
      source: "codex/AGENTS.md",
      sourceSha256: sha256(source),
      rendererRepository: repository,
      rendererRevision: revision,
      rendererSha256: sha256(renderer),
      output: "dist/index.html",
      htmlSha256: sha256(output),
    }, null, 2)}\n`);
    console.log(`Build manifest: ${manifest}`);
  }
} catch (error) {
  console.error(`document-tree: ${error.message}`);
  process.exitCode = 1;
}
