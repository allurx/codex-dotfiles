import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

try {
  const [address, ...extra] = process.argv.slice(2);
  if (!address || extra.length) {
    throw new Error("Usage: node scripts/check-deployment.mjs <https://deployment-url/>");
  }
  const url = new URL(address);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Provide an HTTPS deployment URL without credentials.");
  }
  const assets = [
    { url, name: "index.html", type: /^text\/html(?:\s*;|$)/i },
    { url: new URL("favicon.ico", url), name: "favicon.ico", type: /^image\/(?:x-icon|vnd\.microsoft\.icon)(?:\s*;|$)/i },
    { url: new URL("favicon.svg", url), name: "favicon.svg", type: /^image\/svg\+xml(?:\s*;|$)/i },
  ].map((asset) => ({ ...asset, expected: readFileSync(new URL(`../dist/${asset.name}`, import.meta.url)) }));
  const sourceSha256 = sha256(readFileSync(new URL("../codex/AGENTS.md", import.meta.url)));
  const sourceMetadata = `<meta name="source-sha256" content="${sourceSha256}">`;
  if (!assets[0].expected.toString("utf8").includes(sourceMetadata)) {
    throw new Error("Local dist/index.html does not match codex/AGENTS.md. Run npm run build and npm run check first.");
  }
  let verified = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      for (const asset of assets) {
        const response = await fetch(asset.url, {
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
          cache: "no-store",
        });
        if (response.status !== 200) {
          await response.body?.cancel();
          throw new Error(`${asset.url.href}: expected HTTP 200, received ${response.status}.`);
        }
        if (!asset.type.test(response.headers.get("content-type") ?? "")) {
          await response.body?.cancel();
          throw new Error(`${asset.url.href}: unexpected Content-Type ${response.headers.get("content-type") ?? "(missing)"}.`);
        }
        const deployed = Buffer.from(await response.arrayBuffer());
        if (!deployed.equals(asset.expected)) {
          throw new Error(`${asset.url.href}: bytes differ from the verified artifact; expected SHA-256 ${sha256(asset.expected)}, received ${sha256(deployed)}.`);
        }
      }
      for (const asset of assets) {
        console.log(`Verified ${asset.url.href}\nSHA-256: ${sha256(asset.expected)}`);
      }
      console.log(`Source SHA-256: ${sourceSha256}`);
      verified = true;
      break;
    } catch (error) {
      console.error(`Deployment check ${attempt}/3: ${error.message}`);
      if (attempt < 3) await setTimeout(5_000);
    }
  }
  if (!verified) throw new Error("Deployment did not match the local artifact after 3 attempts.");
} catch (error) {
  console.error(`check-deployment: ${error.message}`);
  process.exitCode = 1;
}
