import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { runCli, type CliOutput } from "./commands.js";
import type { QuotaProvider } from "@kuota/providers";

function recordingOutput() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output: CliOutput = {
    writeStdout: (value) => {
      stdout.push(value);
    },
    writeStderr: (value) => {
      stderr.push(value);
    },
  };
  return { output, stdout, stderr };
}

describe("Kuota Effect CLI", () => {
  it("lists the three built-in provider IDs as one JSON document", async () => {
    const sink = recordingOutput();
    const code = await runCli(["providers", "--json"], sink.output);
    expect(code).toBe(0);
    expect(sink.stdout).toHaveLength(1);
    const result = JSON.parse(sink.stdout[0]!);
    expect(result.schemaVersion).toBe(1);
    expect(result.providers.map((p: { id: string }) => p.id)).toEqual([
      "codex",
      "claude",
      "antigravity",
    ]);
    expect(sink.stderr).toEqual([]);
  });

  it("reports selected provider quota without spawning unrelated adapters", async () => {
    const sink = recordingOutput();
    const providers: QuotaProvider[] = [
      {
        id: "codex",
        label: "OpenAI Codex",
        read: () =>
          Effect.succeed({
            provider: "codex" as const,
            status: "ok" as const,
            fetchedAt: "2026-11-05T12:00:00Z",
            source: "fixture",
            windows: [
              { windowId: "primary", usedPercent: 20, remainingPercent: 80, resetAt: null },
            ],
            errorCode: null,
          }),
      },
    ];
    const code = await runCli(["status", "--provider", "codex", "--json"], sink.output, providers);
    expect(code).toBe(0);
    const result = JSON.parse(sink.stdout[0]!);
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].windows[0].remainingPercent).toBe(80);
    expect(result.providers[0].provider).toBe("codex");
  });

  it("returns a parseable JSON error for unknown provider selection", async () => {
    const sink = recordingOutput();
    const code = await runCli(
      ["status", "--provider", "not-a-real-provider", "--json"],
      sink.output,
      [],
    );
    expect(code).toBe(2);
    const parsed = JSON.parse(sink.stdout[0]!);
    expect(parsed.errors).toEqual([{ code: "UNKNOWN_PROVIDER" }]);
    expect(parsed.providers).toEqual([]);
    expect(sink.stderr).toEqual([]);
  });

  it("routes the tui subcommand to its own entrypoint without touching CLI stdout", async () => {
    const sink = recordingOutput();
    let starts = 0;
    const code = await runCli(["tui"], sink.output, [], async () => {
      starts += 1;
    });
    expect(code).toBe(0);
    expect(starts).toBe(1);
    expect(sink.stdout).toEqual([]);
    expect(sink.stderr).toEqual([]);
  });

  it("prints an actionable non-TTY fallback instead of a generic CLI failure", async () => {
    const sink = recordingOutput();
    const code = await runCli(["tui"], sink.output, [], async () => {
      throw new Error(
        "Kuota TUI requires an interactive terminal; run `kuota status --json` instead.",
      );
    });
    expect(code).toBe(1);
    expect(sink.stderr[0]).toContain("kuota status --json");
    expect(sink.stderr[0]).not.toContain("Unable to execute command");
  });
});
