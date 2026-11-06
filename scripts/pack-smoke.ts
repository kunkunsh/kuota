#!/usr/bin/env bun
/**
 * Smoke test for Kuota npm release package:
 * 1. Runs `bun scripts/build-release.ts`
 * 2. Packs `packages/npm-dist` into a temporary `.tgz`
 * 3. Tests `npx --package <tgz> kuota doctor --json` and `kuota providers --json`
 *    in an isolated temporary directory outside the repository.
 * 4. Ensures zero workspace leakage and 100% standalone execution.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = process.cwd();
const stagingDir = join(repoRoot, "packages", "npm-dist");

console.log("🧪 Running Kuota pack smoke test...");

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

  // Smoke test A: kuota doctor --json
  const doctor = await run("npx", ["-y", "--package", tarballPath, "kuota", "doctor", "--json"], {
    cwd: testDir,
  });
  const doctorJson = JSON.parse(doctor.stdout.trim());
  if (doctorJson.schemaVersion !== 1 || !Array.isArray(doctorJson.tools)) {
    throw new Error(`Invalid doctor output: ${doctor.stdout}`);
  }
  console.log("  ✓ `kuota doctor --json` verified");

  // Smoke test B: kuota providers --json
  const providers = await run("npx", ["-y", "--package", tarballPath, "kuota", "providers", "--json"], {
    cwd: testDir,
  });
  const providersJson = JSON.parse(providers.stdout.trim());
  if (providersJson.schemaVersion !== 1 || !Array.isArray(providersJson.providers)) {
    throw new Error(`Invalid providers output: ${providers.stdout}`);
  }
  console.log("  ✓ `kuota providers --json` verified");

  console.log("\n🎉 All smoke tests passed! The tarball is 100% standalone and ready for `npm publish` / `npx kuota`.");
} finally {
  await rm(tarballPath, { force: true });
  await rm(testDir, { recursive: true, force: true });
}
