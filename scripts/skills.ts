import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const skillRepository = "https://github.com/allurx/agent-skills.git";
export const skillNames = ["instruction-structurer", "markdown-tree-view"];

export interface SkillCheckout {
    revision: string;
    directory: string;
}

const upstreamRef = "refs/heads/main";
const root = fileURLToPath(new URL("../", import.meta.url));

function git(args: string[], cwd = root): string {
    const options: SpawnSyncOptionsWithStringEncoding = { cwd, encoding: "utf8", windowsHide: true };
    let result = spawnSync("git", ["--no-optional-locks", ...args], options);
    if (!result.error && result.status !== 0 && result.stderr.includes("detected dubious ownership")) {
        // Trust only this tool checkout, without changing the user's global Git configuration.
        result = spawnSync(
            "git",
            ["--no-optional-locks", "-c", `safe.directory=${cwd.replaceAll("\\", "/")}`, ...args],
            options
        );
    }
    if (result.error || result.status !== 0) {
        throw new Error(`git ${args[0] ?? "command"} failed: ${result.error?.message ?? result.stderr.trim()}`);
    }
    return result.stdout.trim();
}

function resolveLatestRevision(): string {
    const remote = git(["ls-remote", "--exit-code", skillRepository, upstreamRef]);
    const [revision, ref, ...extra] = remote.split(/\s+/u);
    if (!revision || !/^[0-9a-f]{40}$/u.test(revision) || ref !== upstreamRef || extra.length) {
        throw new Error(`Cannot resolve the latest Skills revision from ${skillRepository} ${upstreamRef}.`);
    }
    return revision;
}

function cacheDirectory(revision: string): string {
    return join(root, "work/tools", `agent-skills-${revision}`);
}

function downloadSkills(directory: string, revision: string): void {
    mkdirSync(dirname(directory), { recursive: true });
    mkdirSync(directory);
    git(["init", "--quiet"], directory);
    git(["config", "core.autocrlf", "false"], directory);
    git(["remote", "add", "origin", skillRepository], directory);
    git(["fetch", "--quiet", "--depth=1", "origin", revision], directory);
    git(["sparse-checkout", "set", ...skillNames.map((name) => `skills/${name}`)], directory);
    git(["checkout", "--quiet", "--detach", "FETCH_HEAD"], directory);
}

export function readCachedSkills(revision: string): SkillCheckout {
    const directory = cacheDirectory(revision);
    const cacheGit = (args: string[]) => git(args, directory);
    if (!existsSync(directory)) {
        throw new Error(`Tool cache is missing: ${directory}. Run npm run build before checking.`);
    }
    if (!lstatSync(directory).isDirectory() || !existsSync(join(directory, ".git"))) {
        throw new Error(
            `Tool cache is not a Git checkout: ${directory}. Inspect it before moving it aside and retrying.`
        );
    }
    if (cacheGit(["remote", "get-url", "origin"]) !== skillRepository || cacheGit(["rev-parse", "HEAD"]) !== revision) {
        throw new Error(
            `Tool cache does not match the selected repository and revision: ${directory}. No files were overwritten.`
        );
    }
    if (cacheGit(["status", "--porcelain", "--untracked-files=all"])) {
        throw new Error(`Tool cache contains changes: ${directory}. Preserve or resolve them before retrying.`);
    }
    const skillFiles = cacheGit([
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        "HEAD",
        "--",
        ...skillNames.map((name) => `skills/${name}`),
    ])
        .split("\0")
        .filter(Boolean);
    if (
        skillNames.some((name) => !skillFiles.includes(`skills/${name}/SKILL.md`)) ||
        skillFiles.some((path) => !existsSync(join(directory, path)))
    ) {
        throw new Error(`Tool cache is incomplete: ${directory}. Both complete Skill directories are required.`);
    }
    return { revision, directory };
}

export function syncSkills(): SkillCheckout {
    const revision = resolveLatestRevision();
    const directory = cacheDirectory(revision);
    if (!existsSync(directory)) downloadSkills(directory, revision);
    return readCachedSkills(revision);
}
