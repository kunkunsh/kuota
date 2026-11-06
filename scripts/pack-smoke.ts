#!/usr/bin/env bun
/**
 * Smoke test for @kunkun.sh/kuota npm release package:
 * 1. Runs `bun scripts/build-release.ts`
 * 2. Packs `packages/npm-dist` into a temporary `.tgz`
 * 3. Tests `npx --package <tgz> kuota doctor --json` in an isolated directory
 * 4. Tests importing `@kunkun.sh/kuota` as a library in an isolated Node script
 * 5. Ensures zero workspace leakage and 100% functional execution.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = process.cwd();
const stagingDir = join(repoRoot, "packages", "npm-dist");

console.log("🧪 Running @kunkun.sh/kuota pack smoke test...");

// Step 1: Build release
await run("bun", ["scripts/build-release.ts"], { cwd: repoRoot });

// Step 2: npm pack in staging directory
const packRes = await run("npm", ["pack"], { cwd: stagingDir });
const tarballName = packRes.stdout.trim().split("\n").pop()?.trim();
if (!tarballName || !tarballName.endsWith(".tgz")) {
  throw new Error(`Failed to find packed tarball name in output: ${packRes.stdout}`);
}
const tarballPath = join(stagingDir, tarballName);
console.log(`  ✓ Tarball created: ${tarballName}`);

// Step 3: Run isolated tests in temporary folder
const testDir = await mkdtemp(join(tmpdir(), "kuota-smoke-"));

try {
  console.log(`  ✓ Running isolated execution in ${testDir}...`);

  // Smoke test A: kuota doctor --json via npx
  const doctor = await run("npx", ["-y", "--package", tarballPath, "kuota", "doctor", "--json"], {
    cwd: testDir,
  });
  const doctorJson = JSON.parse(doctor.stdout.trim());
  if (doctorJson.schemaVersion !== 1 || !Array.isArray(doctorJson.tools)) {
    throw new Error(`Invalid doctor output: ${doctor.stdout}`);
  }
  console.log("  ✓ CLI verification: `kuota doctor --json` passed");

  // Smoke test B: kuota providers --json via npx
  const providers = await run(
    "npx",
    ["-y", "--package", tarballPath, "kuota", "providers", "--json"],
    {
      cwd: testDir,
    },
  );
  const providersJson = JSON.parse(providers.stdout.trim());
  if (providersJson.schemaVersion !== 1 || !Array.isArray(providersJson.providers)) {
    throw new Error(`Invalid providers output: ${providers.stdout}`);
  }
  console.log("  ✓ CLI verification: `kuota providers --json` passed");

  // Smoke test C: Library import verification
  await run("npm", ["init", "-y"], { cwd: testDir });
  // Add "type": "module" to testDir package.json
  const pkgJsonPath = join(testDir, "package.json");
  const pkg = JSON.parse(await Bun.file(pkgJsonPath).text());
  pkg.type = "module";
  await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2));

  // Install the packaged tarball
  await run("npm", ["install", tarballPath], { cwd: testDir });

  // Test script that imports @kunkun.sh/kuota
  const testScript = `
import { parseProviderQuota, calculatePace, PROVIDER_METADATA } from "@kunkun.sh/kuota";
import { parseCodexRateLimits } from "@kunkun.sh/kuota/parsers";

if (!Array.isArray(PROVIDER_METADATA) || PROVIDER_METADATA.length !== 3) {
  throw new Error("PROVIDER_METADATA failed");
}

const raw = {
  rateLimits: {
    primary: { usedPercent: 42, resetsAt: Math.floor(Date.now() / 1000) + 100000, windowDurationMins: 10080 }
  }
};
const snapshot = parseProviderQuota("codex", raw);
if (snapshot.provider !== "codex" || snapshot.windows[0]?.remainingPercent !== 58) {
  throw new Error("parseProviderQuota failed: " + JSON.stringify(snapshot));
}

const pace = calculatePace({
  now: new Date(),
  startAt: new Date(Date.now() - 3600000),
  resetAt: new Date(Date.now() + 3600000),
  usedPercent: 50,
  semantics: "fixed",
  startSource: "provider"
});
if (!pace || pace.idealRemainingPercent !== 50) {
  throw new Error("calculatePace failed");
}

console.log("LIBRARY_OK");
`;
  await writeFile(join(testDir, "test-lib.mjs"), testScript);
  const libRes = await run("node", ["test-lib.mjs"], { cwd: testDir });
  if (!libRes.stdout.includes("LIBRARY_OK")) {
    throw new Error(`Library test failed: ${libRes.stdout}\n${libRes.stderr}`);
  }
  console.log("  ✓ Library verification: import { parseProviderQuota, calculatePace } passed");

  console.log(
    "\n🎉 All smoke tests passed! Both CLI and Library contracts are 100% functional and ready to publish.",
  );
} finally {
  await rm(tarballPath, { force: true });
  await rm(testDir, { recursive: true, force: true });
}
