#!/usr/bin/env bun
/**
 * `bun run desktop:build` — Build the Kuota native desktop application (Tauri v2).
 *
 * Modeled after refyard & space-lens build orchestrators:
 * 1. Builds the Web SPA in `packages/kunkun` so that static assets exist before Tauri compilation.
 * 2. Compiles the Rust host shell with Tauri v2.
 * 3. Verifies the macOS `.app` bundle production and reports installed bundle size.
 *
 * Options:
 *   --web-only    Builds only the web frontend SPA without invoking Rust/Tauri.
 */
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const kunkunDir = join(repoRoot, "packages", "kunkun");
const desktopDir = join(repoRoot, "apps", "desktop");
const webDist = join(kunkunDir, "dist");
const webIndex = join(webDist, "index.html");
const bundleRoot = join(desktopDir, "src-tauri", "target", "release", "bundle", "macos");
const appBundle = join(bundleRoot, "Kuota.app");

const webOnly = process.argv.includes("--web-only");

async function run(
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env?: Record<string, string | undefined> },
): Promise<void> {
  await new Promise<void>((settle, fail) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.once("error", (error) => {
      fail(
        new Error(`${command} could not be started (${error.message}); run \`bun install\` first`),
      );
    });
    child.once("exit", (code, signal) => {
      if (code === 0) settle();
      else
        fail(
          new Error(
            `${command} ${args.join(" ")} ${signal === null ? `exited with code ${code}` : `was killed by signal ${signal}`}`,
          ),
        );
    });
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function bytesUnder(path: string): Promise<number> {
  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      total += await bytesUnder(child);
    } else if (entry.isFile()) {
      total += (await stat(child)).size;
    }
  }
  return total;
}

function mib(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

console.log("⚡ Building Kuota Desktop Application (Tauri v2)...");

// Step 1: Build the Web UI SPA
console.log("🌐 Step 1: Packaging Web UI SPA...");
await run("bun", ["x", "vp", "build"], { cwd: kunkunDir });

if (!(await pathExists(webIndex))) {
  throw new Error(`Frontend build did not produce ${webIndex}; refusing to build native shell.`);
}
console.log(`  ✓ Web frontend compiled to ${webDist}`);

if (webOnly) {
  console.log("✅ --web-only specified: desktop frontend build complete.");
  process.exit(0);
}

// Step 2: Build the native desktop shell using Tauri v2
console.log("🦀 Step 2: Compiling Rust host and packaging macOS .app bundle...");
await run("bun", ["x", "tauri", "build"], { cwd: desktopDir });

if (process.platform === "darwin") {
  if (!(await pathExists(appBundle))) {
    throw new Error(`The macOS bundle was not produced at ${appBundle}`);
  }
  const installedBytes = await bytesUnder(appBundle);
  console.log(`\n🎉 Kuota Desktop Application successfully built!`);
  console.log(`  Bundle:    ${appBundle}`);
  console.log(`  Installed: ${mib(installedBytes)} MiB`);
} else {
  console.log("\n🎉 Kuota Desktop Application built for host platform!");
}
