import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { Effect } from "effect";
import { PROVIDER_METADATA, readAll, type QuotaProvider, builtInProviders, readConfigSync, writeConfig } from "@kuota/providers";
import type { CliOutput } from "./commands.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export interface WebServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

async function findWebDir(): Promise<string | null> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Next to bundled dist: dist/web
    join(currentDir, "web"),
    // In monorepo development: packages/kunkun/dist
    join(currentDir, "..", "..", "kunkun", "dist"),
    // Direct from cwd
    join(process.cwd(), "packages", "kunkun", "dist"),
    join(process.cwd(), "dist", "web"),
  ];

  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isDirectory()) {
        const indexFile = join(candidate, "index.html");
        const idx = await stat(indexFile);
        if (idx.isFile()) return candidate;
      }
    } catch {
      // Continue checking next candidate
    }
  }
  return null;
}

function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execFile("open", [url], () => {});
    } else if (process.platform === "win32") {
      execFile("cmd", ["/c", "start", url], () => {});
    } else {
      execFile("xdg-open", [url], () => {});
    }
  } catch {
    // Non-fatal if browser cannot be launched
  }
}

export async function startWebServer(
  options: WebServerOptions = {},
  output: CliOutput = {
    writeStdout: (m) => process.stdout.write(`${m}\n`),
    writeStderr: (m) => process.stderr.write(`${m}\n`),
  },
  providers: readonly QuotaProvider[] = builtInProviders(),
): Promise<void> {
  const port = options.port ?? 5173;
  const host = options.host ?? "127.0.0.1";
  const shouldOpen = options.open ?? true;

  const webDir = await findWebDir();
  let cachedEnvelope: { data: string; expiresAt: number } | null = null;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Add CORS headers for local tooling and API calls
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // API Routes
    if (pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      return;
    }

    if (pathname === "/api/config") {
      if (req.method === "GET") {
        const config = readConfigSync();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(config));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const updated = await writeConfig(parsed);
            cachedEnvelope = null; // Invalidate cached telemetry
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, config: updated }));
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
        return;
      }
    }

    if (pathname === "/api/status") {
      try {
        const forceFresh = url.searchParams.get("fresh") === "1";
        const now = Date.now();
        if (!forceFresh && cachedEnvelope && now < cachedEnvelope.expiresAt) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(cachedEnvelope.data);
          return;
        }

        const ids = PROVIDER_METADATA.map((item) => item.id);
        const snapshots = await Effect.runPromise(readAll(ids, providers));
        const envelope = {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          providers: snapshots,
          errors: [],
        };
        const serialized = JSON.stringify(envelope);
        cachedEnvelope = { data: serialized, expiresAt: now + 15_000 };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(serialized);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // Static Web UI Hosting
    if (webDir) {
      let relativePath = pathname === "/" ? "/index.html" : pathname;
      let filePath = join(webDir, relativePath);

      try {
        let fileStat = await stat(filePath).catch(() => null);
        // SPA Fallback: if not found or is directory, serve index.html
        if (!fileStat || fileStat.isDirectory()) {
          filePath = join(webDir, "index.html");
          fileStat = await stat(filePath).catch(() => null);
        }

        if (fileStat && fileStat.isFile()) {
          const ext = extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
          const data = await readFile(filePath);
          res.writeHead(200, { "Content-Type": contentType });
          res.end(data);
          return;
        }
      } catch {
        // Fallback to error below
      }
    }

    // Fallback landing page if web bundle not built
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kuota Web Workbench</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center; }
            h1 { font-size: 20px; margin-bottom: 8px; color: #fff; }
            p { font-size: 14px; color: #a1a1aa; line-height: 1.5; }
            code { background: #27272a; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #38bdf8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Kuota Web Workbench</h1>
            <p>Static bundle was not detected beside the CLI binary.</p>
            <p>API endpoint is active at <code>/api/status</code>.</p>
          </div>
        </body>
      </html>
    `);
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const serverUrl = `http://${host}:${port}`;
      output.writeStdout(`\n  ⚡ Kuota Web Workbench running at: ${serverUrl}`);
      output.writeStdout(`  Press Ctrl+C to stop.\n`);

      if (shouldOpen) {
        openBrowser(serverUrl);
      }
    });

    const shutdown = () => {
      server.close(() => {
        resolve();
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}
