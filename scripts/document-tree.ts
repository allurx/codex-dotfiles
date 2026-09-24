import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCachedSkills, skillNames, skillRepository, syncSkills } from "./skills.ts";
import type { SkillCheckout } from "./skills.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "codex/AGENTS.md");
const rendered = join(root, "work/rendered/agents.html");
const output = join(root, "dist/index.html");
const icons = ["favicon.ico", "favicon.svg"];
const distributionFiles = ["index.html", ...icons];
const manifest = join(root, "work/build-manifest.json");

function readRecordedRevision(): string {
    if (!existsSync(manifest)) throw new Error("Build manifest is missing. Run npm run build before checking.");
    const recorded: unknown = JSON.parse(readFileSync(manifest, "utf8"));
    if (
        typeof recorded !== "object" ||
        recorded === null ||
        !("rendererRepository" in recorded) ||
        recorded.rendererRepository !== skillRepository ||
        !("rendererRevision" in recorded) ||
        typeof recorded.rendererRevision !== "string" ||
        !/^[0-9a-f]{40}$/u.test(recorded.rendererRevision)
    ) {
        throw new Error(
            "Build manifest has an invalid Skills repository or revision. Run npm run build before checking."
        );
    }
    return recorded.rendererRevision;
}

function rendererPath(skills: SkillCheckout): string {
    return join(skills.directory, "skills/markdown-tree-view/scripts/markdown-tree-view.mjs");
}

function sha256(path: string): string {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function renderDocument(renderer: string, mode: "build" | "check"): void {
    const result = spawnSync(
        process.execPath,
        [renderer, "--input", source, "--output", rendered, ...(mode === "check" ? ["--check"] : [])],
        { cwd: root, stdio: "inherit", windowsHide: true }
    );
    if (result.error || result.status !== 0) {
        throw new Error(
            `Document tree ${mode} failed${result.error ? `: ${result.error.message}` : ` (exit ${String(result.status)})`}.`
        );
    }
}

function addFavicons(html: string): Buffer {
    const policies = html.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/gu);
    const policy = policies?.[0];
    if (policies?.length !== 1 || policy?.split("img-src 'none'").length !== 2 || html.split("</head>").length !== 2) {
        throw new Error("Renderer output has an unexpected head or CSP. Review favicon integration before rebuilding.");
    }
    const links = [
        '<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">',
        '<link rel="icon" href="favicon.svg" type="image/svg+xml" sizes="any">',
    ].join("\n");
    return Buffer.from(
        html.replace(policy, policy.replace("img-src 'none'", "img-src 'self'")).replace("</head>", `${links}\n</head>`)
    );
}

function verifyDistribution(allowMissing = false): void {
    const directory = dirname(output);
    const metadata = lstatSync(directory, { throwIfNoEntry: false });
    if (!metadata && allowMissing) return;
    if (!metadata?.isDirectory()) {
        throw new Error(`Distribution must be a regular directory, not a symlink: ${directory}`);
    }
    const entries = readdirSync(directory, { withFileTypes: true });
    const unexpected = entries.filter((entry) => !distributionFiles.includes(entry.name) || !entry.isFile());
    if (unexpected.length) {
        throw new Error(
            `Distribution may contain only these regular files: ${distributionFiles.join(", ")}. Inspect these unexpected targets before retrying: ${unexpected.map((entry) => join(directory, entry.name)).join(", ")}`
        );
    }
    const missing = distributionFiles.filter((name) => !entries.some((entry) => entry.name === name));
    if (!allowMissing && missing.length) {
        throw new Error(
            `Distribution is missing required files: ${missing.map((name) => join(directory, name)).join(", ")}`
        );
    }
}

function readSiteArtifacts(): Map<string, Buffer> {
    const artifacts = new Map([["index.html", addFavicons(readFileSync(rendered, "utf8"))]]);
    for (const name of icons) artifacts.set(name, readFileSync(join(root, "site", name)));
    return artifacts;
}

function verifySiteArtifacts(artifacts: Map<string, Buffer>): void {
    verifyDistribution();
    for (const [name, bytes] of artifacts) {
        const path = join(dirname(output), name);
        if (!readFileSync(path).equals(bytes)) throw new Error(`Output is missing or differs: ${path}`);
    }
}

function writeBuildManifest(skills: SkillCheckout): void {
    const provenance = {
        source: "codex/AGENTS.md",
        sourceSha256: sha256(source),
        rendererRepository: skillRepository,
        rendererRevision: skills.revision,
        rendererSha256: sha256(rendererPath(skills)),
        output: "dist/index.html",
        htmlSha256: sha256(output),
        iconSha256: Object.fromEntries(icons.map((name) => [name, sha256(join(dirname(output), name))])),
    };
    writeFileSync(manifest, `${JSON.stringify(provenance, null, 2)}\n`);
    console.log(`Build manifest: ${manifest}`);
}

function buildSite(): void {
    verifyDistribution(true);
    const skills = syncSkills();
    const renderer = rendererPath(skills);
    renderDocument(renderer, "build");
    renderDocument(renderer, "check");
    const artifacts = readSiteArtifacts();
    mkdirSync(dirname(output), { recursive: true });
    for (const [name, bytes] of artifacts) writeFileSync(join(dirname(output), name), bytes);
    verifySiteArtifacts(artifacts);
    console.log(`Site files generated and verified: ${dirname(output)}`);
    writeBuildManifest(skills);
}

function checkSite(): void {
    verifyDistribution();
    const skills = readCachedSkills(readRecordedRevision());
    renderDocument(rendererPath(skills), "check");
    verifySiteArtifacts(readSiteArtifacts());
    console.log(`Site files verified: ${dirname(output)}`);
}

function main(args: string[]): void {
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    if (major < 24 || (major === 24 && minor < 12)) {
        throw new Error("Node.js 24.12.0 or newer is required.");
    }
    const [mode, ...extra] = args;
    if ((mode !== "build" && mode !== "check" && mode !== "sync-skills") || extra.length) {
        throw new Error("Usage: node scripts/document-tree.ts <build|check|sync-skills>");
    }
    switch (mode) {
        case "build":
            buildSite();
            break;
        case "check":
            checkSite();
            break;
        case "sync-skills": {
            const skills = syncSkills();
            console.log(`Latest Skills revision: ${skills.revision}`);
            for (const name of skillNames)
                console.log(`${name}: ${join(skills.directory, "skills", name, "SKILL.md")}`);
            break;
        }
    }
}

try {
    main(process.argv.slice(2));
} catch (error) {
    console.error(`document-tree: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
