import { describe, expect, it } from "vitest";
import { parseAntigravityUsageReport, parseAgyVersion, readAntigravity } from "./index.js";
import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function usageReport() {
  return {
    status: "SUCCESS",
    command: {
      name: "usage",
      data: {
        groups: [
          {
            name: "Gemini Models",
            buckets: [
              {
                id: "gemini-weekly",
                window: "weekly",
                remaining_fraction: 0.86,
                reset_time: "2026-09-17T18:40:27Z",
              },
              { id: "gemini-5h", window: "5h", remaining_fraction: 0.95 },
            ],
          },
          {
            name: "Claude and GPT models",
            buckets: [
              { id: "3p-weekly", window: "weekly", remaining_fraction: 0.89 },
              { id: "3p-5h", window: "5h", remaining_fraction: 1 },
            ],
          },
        ],
      },
    },
  };
}

describe("Antigravity agy CLI parser", () => {
  it("preserves separate model-family quotas and reset dates", () => {
    const snapshot = parseAntigravityUsageReport(usageReport());
    expect(snapshot.provider).toBe("antigravity");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.windows.map((w) => [w.windowId, w.remainingPercent])).toEqual([
      ["gemini.weekly", 86],
      ["gemini.5h", 95],
      ["claude-gpt.weekly", 89],
      ["claude-gpt.5h", 100],
    ]);
    expect(snapshot.windows[0]?.resetAt).toBe("2026-09-17T18:40:27.000Z");
  });

  it("rejects unrelated, disabled and unmeasured reports", () => {
    expect(() => parseAntigravityUsageReport({ ...usageReport(), status: "PENDING" })).toThrow();
    expect(() =>
      parseAntigravityUsageReport({
        ...usageReport(),
        command: { ...usageReport().command, name: "chat" },
      }),
    ).toThrow();
    const unavailable = usageReport();
    unavailable.command.data.groups[0]!.buckets[0]!.remaining_fraction = Number.NaN;
    unavailable.command.data.groups[0]!.buckets[1]!.remaining_fraction = 5;
    unavailable.command.data.groups[1]!.buckets[0]!.remaining_fraction = -1;
    unavailable.command.data.groups[1]!.buckets[1]!.remaining_fraction = Number.NaN;
    expect(() => parseAntigravityUsageReport(unavailable)).toThrow();
  });

  it("requires exact semver at least 1.1.11", () => {
    expect(parseAgyVersion("1.5.1\n")).toBe(true);
    expect(parseAgyVersion("1.1.11")).toBe(true);
    for (const s of ["1.1.10", "0.99.0", "1.2.2-preview", "v1.2.2", "1.2.2.1", "unknown"]) {
      expect(parseAgyVersion(s)).toBe(false);
    }
  });
});

describe("Antigravity agy CLI subprocess", () => {
  it("runs supported print mode without auto-update and guards browser sign-in", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kuota-agy-test-"));
    const binary = join(dir, "fake-agy");
    const marker = join(dir, "flags.txt");
    try {
      await writeFile(
        binary,
        `#!/bin/sh
if [ "$1" = "--version" ]; then echo 1.5.1; exit 0; fi
[ "$*" = "-p /usage --output-format json --print-timeout 90s" ] || exit 42
[ "$AGY_CLI_DISABLE_AUTO_UPDATE" = true ] || exit 43
[ -n "$BROWSER" ] || exit 44
printf '%s' "$BROWSER" > '${marker}'
printf '%s' '${JSON.stringify(usageReport())}'
`,
        { mode: 0o700 },
      );
      const snapshot = await Effect.runPromise(readAntigravity({ binary, timeoutMs: 1000 }));
      expect(snapshot.status).toBe("ok");
      expect(snapshot.windows).toHaveLength(4);
      expect((await readFile(marker, "utf8")).includes("kuota-agy-")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails closed for missing binary and oversized or failed command output", async () => {
    const missing = await Effect.runPromise(
      readAntigravity({ binary: "/kuota/nonexistent/agy", timeoutMs: 100 }),
    );
    expect(missing.status).toBe("unavailable");
    expect(missing.errorCode).toBe("BINARY_NOT_FOUND");
    const dir = await mkdtemp(join(tmpdir(), "kuota-agy-test-"));
    const binary = join(dir, "fake-agy");
    try {
      await writeFile(
        binary,
        `#!/bin/sh
if [ "$1" = "--version" ]; then echo 1.5.1; exit 0; fi
printf '%0100000d' 0
`,
        { mode: 0o700 },
      );
      const tooLarge = await Effect.runPromise(
        readAntigravity({ binary, timeoutMs: 1000, maxOutputBytes: 4096 }),
      );
      expect(tooLarge.status).toBe("unavailable");
      expect(tooLarge.errorCode).toBe("OUTPUT_TOO_LARGE");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
