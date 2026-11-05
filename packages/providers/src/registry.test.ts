import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { makeUnavailableSnapshot, type QuotaSnapshot } from "@kuota/core";
import { readAll, type QuotaProvider } from "./registry.js";

const okSnapshot: QuotaSnapshot = {
  provider: "codex",
  status: "ok",
  fetchedAt: "2026-11-05T12:00:00.000Z",
  source: "fixture",
  windows: [],
  errorCode: null,
};

describe("provider registry", () => {
  it("preserves requested order while isolating failures", async () => {
    const providers: QuotaProvider[] = [
      {
        id: "claude",
        label: "Claude",
        read: () => Effect.fail(new Error("private authorization details")),
      },
      { id: "codex", label: "Codex", read: () => Effect.succeed(okSnapshot) },
    ];
    const output = await Effect.runPromise(readAll(["codex", "claude"], providers));
    expect(output.map((item) => [item.provider, item.status])).toEqual([
      ["codex", "ok"],
      ["claude", "unavailable"],
    ]);
    expect(JSON.stringify(output)).not.toContain("private authorization details");
  });

  it("marks an unregistered provider unsupported", async () => {
    const results = await Effect.runPromise(readAll(["antigravity"], []));
    expect(results).toEqual([
      expect.objectContaining({
        provider: "antigravity",
        status: "unsupported",
        errorCode: "NOT_REGISTERED",
      }),
    ]);
  });

  it("does not override a legitimate unauthenticated result", async () => {
    const providers: QuotaProvider[] = [
      {
        id: "codex",
        label: "Codex",
        read: () =>
          Effect.succeed(makeUnavailableSnapshot("codex", "AUTH_REQUIRED", "unauthenticated")),
      },
    ];
    const output = await Effect.runPromise(readAll(["codex"], providers));
    expect(output[0]?.status).toBe("unauthenticated");
    expect(output[0]?.errorCode).toBe("AUTH_REQUIRED");
  });
});
