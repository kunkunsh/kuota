#!/usr/bin/env bun
/**
 * `bun scripts/build-release.ts` — Stage the publishable `kuota` standalone npm package.
 *
 * Modeled after refyard & space-lens release architecture:
 * - Standalone bundle: Bundles all internal workspace packages (@kuota/core, @kuota/history,
 *   @kuota/providers, @kuota/tui) and external dependencies into a single ESM file.
 * - Zero runtime dependencies: The staged packages/npm-dist/package.json has NO dependencies,
 *   so running `npx kuota` downloads only this single standalone tarball with zero extra fetch steps.
 * - Multi-surface: Bundles CLI commands, TUI, loopback web server, and prebuilt React Web UI.
 */
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = join(repoRoot, "packages", "npm-dist");
const distRoot = join(stagingRoot, "dist");
const binRoot = join(stagingRoot, "bin");

console.log("🚀 Building Kuota release bundle...");

// 1. Validate manifest has zero runtime dependencies
const manifest = JSON.parse(
  await readFile(join(stagingRoot, "package.json"), "utf8"),
) as Record<string, unknown>;

for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
  const value = manifest[field];
  if (value !== undefined && Object.keys(value as Record<string, string>).length > 0) {
    throw new Error(
      `packages/npm-dist/package.json declares ${field}; the standalone bundle carries everything, so the published manifest must not declare dependencies.`,
    );
  }
}

// 2. Clean staging directories
await rm(distRoot, { recursive: true, force: true });
await rm(binRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await mkdir(binRoot, { recursive: true });

// 3. Build Web UI SPA (packages/kunkun)
console.log("📦 Building Web UI SPA (packages/kunkun)...");
await run("bun", ["x", "vp", "build"], {
  cwd: join(repoRoot, "packages", "kunkun"),
});

const webSource = join(repoRoot, "packages", "kunkun", "dist");
const webIndex = join(webSource, "index.html");
const webStat = await stat(webIndex).catch(() => null);
if (!webStat?.isFile()) {
  throw new Error("packages/kunkun/dist/index.html is missing after build!");
}

await cp(webSource, join(distRoot, "web"), { recursive: true });
console.log("  ✓ Web UI static assets copied to dist/web");

// 4. Bundle CLI + TUI + Web Server into a single standalone executable
console.log("⚡ Bundling CLI & TUI into standalone ESM bundle...");
const cliEntry = join(repoRoot, "packages", "cli", "src", "main.ts");
const cliOutfile = join(distRoot, "cli.mjs");

const buildRes = await Bun.build({
  entrypoints: [cliEntry],
  outdir: distRoot,
  naming: "cli.mjs",
  target: "node",
  format: "esm",
  minify: false,
});

if (!buildRes.success) {
  console.error("Bundle errors:", buildRes.logs);
  process.exit(1);
}

// 5. Create bin executable shim
const binShim = [
  "#!/usr/bin/env node",
  "// Kuota — Multi-provider AI Quota & Usage Suite",
  'import "../dist/cli.mjs";',
  "",
].join("\n");

const binFile = join(binRoot, "kuota.mjs");
await writeFile(binFile, binShim, "utf8");
await chmod(binFile, 0o755);

// 6. Report bundle info
const bundleBytes = (await stat(cliOutfile)).size;
const webBytes = (await stat(join(distRoot, "web", "index.html"))).size;

console.log("\n✅ Release staging completed successfully!");
console.log(`  Package: ${manifest.name}@${manifest.version}`);
console.log(`  Binary:  bin/kuota.mjs -> dist/cli.mjs (${(bundleBytes / (1024 * 1024)).toFixed(2)} MB standalone)`);
console.log(`  Web SPA: dist/web/ (index.html ${webBytes} B + assets)`);
console.log(`  Dependencies in published manifest: 0 (standalone)`);
