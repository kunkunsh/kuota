#!/usr/bin/env bun
/**
 * `bun scripts/build-release.ts` — Stage the publishable `@kunkun.sh/kuota` package.
 *
 * Dual-role architecture (Library + CLI):
 * - Library exports: index, parsers, metrics, history, providers with full .d.mts TypeScript types.
 * - External dependencies: effect, @uniview/*, react are unbundled and declared in dependencies
 *   so consuming apps/extensions share instances with the host without dual-package hazard.
 * - CLI executable: dist/bin.mjs provides the complete CLI / TUI / Web workbench.
 * - Static Web UI SPA: dist/web contains the prebuilt React dashboard.
 */
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = join(repoRoot, "packages", "npm-dist");
const distRoot = join(stagingRoot, "dist");
const binRoot = join(stagingRoot, "bin");

console.log("🚀 Building @kunkun.sh/kuota library & CLI release bundle...");

// 1. Validate manifest does not leak workspace:* dependencies
const manifest = JSON.parse(
  await readFile(join(stagingRoot, "package.json"), "utf8"),
) as Record<string, unknown>;

const deps = (manifest.dependencies ?? {}) as Record<string, string>;
for (const [name, version] of Object.entries(deps)) {
  if (version.startsWith("workspace:")) {
    throw new Error(
      `packages/npm-dist/package.json declares ${name}: ${version}; workspace:* specifiers cannot be published to npm.`,
    );
  }
}

// 2. Clean staging directories
await rm(distRoot, { recursive: true, force: true });
await rm(binRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await mkdir(binRoot, { recursive: true });

// 3. Pack Library & CLI entrypoints using Vite Plus (vp pack)
console.log("📦 Packaging Library modules & CLI with TypeScript declarations...");
await run(
  "bun",
  [
    "x",
    "vp",
    "pack",
    "src/index.ts",
    "src/parsers.ts",
    "src/metrics.ts",
    "src/history.ts",
    "src/providers.ts",
    "src/bin.ts",
  ],
  {
    cwd: stagingRoot,
  },
);

// 4. Build Web UI SPA (packages/kunkun)
console.log("🌐 Building Web UI SPA (packages/kunkun)...");
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

// 5. Create bin executable shim
const binShim = [
  "#!/usr/bin/env node",
  "// Kuota — Multi-provider AI Quota & Usage Suite (@kunkun.sh/kuota)",
  'import "../dist/bin.mjs";',
  "",
].join("\n");

const binFile = join(binRoot, "kuota.mjs");
await writeFile(binFile, binShim, "utf8");
await chmod(binFile, 0o755);

// 6. Copy README and LICENSE to release package
await cp(join(repoRoot, "README.md"), join(stagingRoot, "README.md"));
await cp(join(repoRoot, "LICENSE"), join(stagingRoot, "LICENSE"));

// 7. Report bundle info
const binBytes = (await stat(join(distRoot, "bin.mjs"))).size;
const libBytes = (await stat(join(distRoot, "index.mjs"))).size;
const dtsBytes = (await stat(join(distRoot, "index.d.mts"))).size;
const webBytes = (await stat(join(distRoot, "web", "index.html"))).size;

console.log("\n✅ Release staging completed successfully!");
console.log(`  Package: ${manifest.name}@${manifest.version}`);
console.log(`  Library: dist/index.mjs (${(libBytes / 1024).toFixed(1)} KB) + dist/index.d.mts (${(dtsBytes / 1024).toFixed(1)} KB)`);
console.log(`  Subpaths: /parsers, /metrics, /history, /providers`);
console.log(`  Binary:  dist/bin.mjs (${(binBytes / 1024).toFixed(1)} KB) + bin/kuota.mjs`);
console.log(`  Web SPA: dist/web/ (index.html ${webBytes} B + assets)`);
console.log(`  Shared dependencies: ${Object.keys(deps).join(", ")}`);
