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
  const expected = readFileSync(new URL("../dist/index.html", import.meta.url));
  const sourceSha256 = sha256(readFileSync(new URL("../codex/AGENTS.md", import.meta.url)));
  const sourceMetadata = `<meta name="source-sha256" content="${sourceSha256}">`;
  if (!expected.toString("utf8").includes(sourceMetadata)) {
    throw new Error("Local dist/index.html does not match codex/AGENTS.md. Run npm run build and npm run check first.");
  }
  const expectedSha256 = sha256(expected);
  let verified = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        cache: "no-store",
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      if (!/^text\/html(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
        await response.body?.cancel();
        throw new Error(`Expected text/html, received ${response.headers.get("content-type") ?? "no Content-Type"}.`);
      }
      const deployed = Buffer.from(await response.arrayBuffer());
      const actualSha256 = sha256(deployed);
      if (!deployed.equals(expected)) {
        throw new Error(`HTML differs from the verified artifact: expected SHA-256 ${expectedSha256}, received ${actualSha256}.`);
      }
      if (!deployed.toString("utf8").includes(sourceMetadata)) {
        throw new Error("Deployed HTML is missing the expected source-sha256 metadata.");
      }
      console.log(`Verified ${url.href}\nHTML SHA-256: ${actualSha256}\nSource SHA-256: ${sourceSha256}`);
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
