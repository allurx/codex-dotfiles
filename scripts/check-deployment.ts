import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

interface DeploymentAsset {
    url: URL;
    type: RegExp;
    expected: Buffer;
}

interface DeploymentArtifact {
    assets: DeploymentAsset[];
    sourceSha256: string;
}

function sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function parseDeploymentUrl(args: string[]): URL {
    const [address, ...extra] = args;
    if (!address || extra.length) {
        throw new Error("Usage: node scripts/check-deployment.ts <https://deployment-url/>");
    }
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Provide an HTTPS deployment URL without credentials.");
    }
    return url;
}

function readArtifact(url: URL): DeploymentArtifact {
    const expectedHtml = readFileSync(new URL("../dist/index.html", import.meta.url));
    const assets = [
        { url, name: "index.html", type: /^text\/html(?:\s*;|$)/i },
        {
            url: new URL("favicon.ico", url),
            name: "favicon.ico",
            type: /^image\/(?:x-icon|vnd\.microsoft\.icon)(?:\s*;|$)/i,
        },
        { url: new URL("favicon.svg", url), name: "favicon.svg", type: /^image\/svg\+xml(?:\s*;|$)/i },
    ].map((asset) => ({
        ...asset,
        expected:
            asset.name === "index.html"
                ? expectedHtml
                : readFileSync(new URL(`../dist/${asset.name}`, import.meta.url)),
    }));
    const sourceSha256 = sha256(readFileSync(new URL("../codex/AGENTS.md", import.meta.url)));
    const sourceMetadata = `<meta name="source-sha256" content="${sourceSha256}">`;
    if (!expectedHtml.toString("utf8").includes(sourceMetadata)) {
        throw new Error(
            "Local dist/index.html does not match codex/AGENTS.md. Run npm run build and npm run check first."
        );
    }
    return { assets, sourceSha256 };
}

async function verifyAsset(asset: DeploymentAsset): Promise<void> {
    const response = await fetch(asset.url, {
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        cache: "no-store",
    });
    if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`${asset.url.href}: expected HTTP 200, received ${String(response.status)}.`);
    }
    const contentType = response.headers.get("content-type");
    if (!asset.type.test(contentType ?? "")) {
        await response.body?.cancel();
        throw new Error(`${asset.url.href}: unexpected Content-Type ${contentType ?? "(missing)"}.`);
    }
    const deployed = Buffer.from(await response.arrayBuffer());
    if (!deployed.equals(asset.expected)) {
        throw new Error(
            `${asset.url.href}: bytes differ from the verified artifact; expected SHA-256 ${sha256(asset.expected)}, received ${sha256(deployed)}.`
        );
    }
}

async function verifyDeployment({ assets, sourceSha256 }: DeploymentArtifact): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            for (const asset of assets) {
                await verifyAsset(asset);
            }
            for (const asset of assets) {
                console.log(`Verified ${asset.url.href}\nSHA-256: ${sha256(asset.expected)}`);
            }
            console.log(`Source SHA-256: ${sourceSha256}`);
            return;
        } catch (error) {
            console.error(
                `Deployment check ${String(attempt)}/3: ${error instanceof Error ? error.message : String(error)}`
            );
            if (attempt < 3) await setTimeout(5_000);
        }
    }
    throw new Error("Deployment did not match the local artifact after 3 attempts.");
}

async function main(): Promise<void> {
    const url = parseDeploymentUrl(process.argv.slice(2));
    await verifyDeployment(readArtifact(url));
}

await main().catch((error: unknown) => {
    console.error(`check-deployment: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
