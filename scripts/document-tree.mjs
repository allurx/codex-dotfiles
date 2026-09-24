import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "https://github.com/allurx/agent-skills.git";
const revision = "366394174b1acc28a83c0d46b6af66972cd2797e";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "codex/AGENTS.md");
const rendered = join(root, "work/rendered/agents.html");
const output = join(root, "dist/index.html");
const icons = ["favicon.ico", "favicon.svg"];
const distributionFiles = ["index.html", ...icons];
const cache = join(root, "work/tools", `markdown-tree-view-${revision}`);
const renderer = join(cache, "skills/markdown-tree-view/scripts/markdown-tree-view.mjs");
const manifest = join(root, "work/build-manifest.json");

function git(args) {
  const options = { cwd: cache, encoding: "utf8", windowsHide: true };
  let result = spawnSync("git", ["--no-optional-locks", ...args], options);
  if (result.status !== 0 && result.stderr?.includes("detected dubious ownership")) {
    // Trust only this tool checkout, without changing the user's global Git configuration.
    result = spawnSync("git", ["--no-optional-locks", "-c", `safe.directory=${cache.replaceAll("\\", "/")}`, ...args], options);
  }
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function ensureRenderer(allowDownload) {
  if (!existsSync(cache)) {
    if (!allowDownload) throw new Error(`Tool cache is missing: ${cache}. Run npm run build before checking.`);
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

function renderDocument(check) {
  const result = spawnSync(process.execPath, [
    renderer, "--input", source, "--output", rendered, ...(check ? ["--check"] : []),
  ], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`Document tree ${check ? "check" : "build"} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}.`);
  }
}

function siteDocument() {
  const html = readFileSync(rendered, "utf8");
  const policies = html.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/gu);
  if (policies?.length !== 1 || policies[0].split("img-src 'none'").length !== 2 || html.split("</head>").length !== 2) {
    throw new Error("Renderer output has an unexpected head or CSP. Review favicon integration before rebuilding.");
  }
  const links = [
    '<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml" sizes="any">',
  ].join("\n");
  return Buffer.from(html
    .replace(policies[0], policies[0].replace("img-src 'none'", "img-src 'self'"))
    .replace("</head>", `${links}\n</head>`));
}

function verifyDistribution(allowMissing = false) {
  const directory = dirname(output);
  const metadata = lstatSync(directory, { throwIfNoEntry: false });
  if (!metadata && allowMissing) return;
  if (!metadata?.isDirectory()) {
    throw new Error(`Distribution must be a regular directory, not a symlink: ${directory}`);
  }
  const entries = readdirSync(directory, { withFileTypes: true });
  const unexpected = entries.filter((entry) => !distributionFiles.includes(entry.name) || !entry.isFile());
  if (unexpected.length) {
    throw new Error(`Distribution may contain only these regular files: ${distributionFiles.join(", ")}. Inspect these unexpected targets before retrying: ${unexpected.map((entry) => join(directory, entry.name)).join(", ")}`);
  }
  const missing = distributionFiles.filter((name) => !entries.some((entry) => entry.name === name));
  if (!allowMissing && missing.length) {
    throw new Error(`Distribution is missing required files: ${missing.map((name) => join(directory, name)).join(", ")}`);
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
  ensureRenderer(mode === "build");
  if (mode === "build") renderDocument(false);
  renderDocument(true);
  const artifacts = new Map([
    ["index.html", siteDocument()],
    ...icons.map((name) => [name, readFileSync(join(root, "site", name))]),
  ]);
  if (mode === "build") {
    mkdirSync(dirname(output), { recursive: true });
    for (const [name, bytes] of artifacts) writeFileSync(join(dirname(output), name), bytes);
  }
  verifyDistribution();
  for (const [name, bytes] of artifacts) {
    const path = join(dirname(output), name);
    if (!readFileSync(path).equals(bytes)) throw new Error(`Output is missing or differs: ${path}`);
  }
  console.log(`Site files ${mode === "build" ? "generated and verified" : "verified"}: ${dirname(output)}`);
  if (mode === "build") {
    writeFileSync(manifest, `${JSON.stringify({
      source: "codex/AGENTS.md",
      sourceSha256: sha256(source),
      rendererRepository: repository,
      rendererRevision: revision,
      rendererSha256: sha256(renderer),
      output: "dist/index.html",
      htmlSha256: sha256(output),
      iconSha256: Object.fromEntries(icons.map((name) => [name, sha256(join(dirname(output), name))])),
    }, null, 2)}\n`);
    console.log(`Build manifest: ${manifest}`);
  }
} catch (error) {
  console.error(`document-tree: ${error.message}`);
  process.exitCode = 1;
}
