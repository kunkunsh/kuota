import { spawn } from "node:child_process";

export type CodexTransportErrorCode = "BINARY_NOT_FOUND" | "TIMEOUT" | "PROTOCOL_ERROR";

/** Fixed, safe error messages: never forward stderr or a raw RPC response. */
export class CodexTransportError extends Error {
  constructor(public readonly code: CodexTransportErrorCode) {
    super(
      {
        BINARY_NOT_FOUND: "Codex executable was not found",
        TIMEOUT: "Codex app-server did not respond in time",
        PROTOCOL_ERROR: "Codex app-server protocol failed",
      }[code],
    );
    this.name = "CodexTransportError";
  }
}

export interface CodexRpcOptions {
  binary?: string;
  args?: readonly string[];
  timeoutMs?: number;
}

/** One bounded RPC session. Never spawns a bare Codex TUI and never prints raw output. */
export function requestCodexRateLimits(options: CodexRpcOptions = {}): Promise<unknown> {
  const binary = options.binary ?? "codex";
  const args = options.args ?? ["app-server"];
  const timeoutMs = Math.max(100, Math.min(options.timeoutMs ?? 15_000, 60_000));

  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], { stdio: ["pipe", "pipe", "pipe"], shell: false });
    let settled = false;
    let phase: "initializing" | "reading" = "initializing";
    let buffer = "";

    const finish = (error?: CodexTransportError, result?: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      if (!child.killed && child.exitCode === null) child.kill("SIGTERM");
      if (error) reject(error);
      else resolve(result);
    };

    const timeout = setTimeout(() => finish(new CodexTransportError("TIMEOUT")), timeoutMs);
    const send = (message: Record<string, unknown>): void => {
      if (settled) return;
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      } catch {
        finish(new CodexTransportError("PROTOCOL_ERROR"));
      }
    };

    child.once("error", (error: NodeJS.ErrnoException) => {
      finish(
        new CodexTransportError(error.code === "ENOENT" ? "BINARY_NOT_FOUND" : "PROTOCOL_ERROR"),
      );
    });
    child.once("exit", () => finish(new CodexTransportError("PROTOCOL_ERROR")));
    child.stdin.on("error", () => finish(new CodexTransportError("PROTOCOL_ERROR")));
    child.stderr.resume(); // Consume without collecting or logging potentially sensitive details.

    const onMessage = (value: unknown): void => {
      const msg =
        value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
      if (!msg || typeof msg.id !== "number") return; // Notifications may interleave.
      if (phase === "initializing" && msg.id === 1) {
        if (msg.error || !msg.result) return finish(new CodexTransportError("PROTOCOL_ERROR"));
        phase = "reading";
        send({ method: "initialized" });
        send({ id: 2, method: "account/rateLimits/read" });
      } else if (phase === "reading" && msg.id === 2) {
        if (msg.error || !msg.result) return finish(new CodexTransportError("PROTOCOL_ERROR"));
        finish(undefined, msg.result);
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      if (buffer.length > 2_000_000) return finish(new CodexTransportError("PROTOCOL_ERROR"));
      while (!settled) {
        const index = buffer.indexOf("\n");
        if (index < 0) break;
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        try {
          onMessage(JSON.parse(line));
        } catch {
          finish(new CodexTransportError("PROTOCOL_ERROR"));
        }
      }
    });

    send({
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "kuota", version: "0.1.0" } },
    });
  });
}
