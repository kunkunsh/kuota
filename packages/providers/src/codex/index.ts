import { Effect } from "effect";
import { makeUnavailableSnapshot, type QuotaSnapshot } from "@kuota/core";
import { parseCodexRateLimits } from "./protocol.js";
import { CodexTransportError, requestCodexRateLimits, type CodexRpcOptions } from "./transport.js";

export { parseCodexRateLimits } from "./protocol.js";
export { CodexTransportError, requestCodexRateLimits, type CodexRpcOptions } from "./transport.js";

export function readCodex(options: CodexRpcOptions = {}): Effect.Effect<QuotaSnapshot> {
  return Effect.promise(async () => {
    try {
      return parseCodexRateLimits(await requestCodexRateLimits(options));
    } catch (error) {
      const code = error instanceof CodexTransportError ? error.code : "UNKNOWN";
      return makeUnavailableSnapshot(
        "codex",
        code,
        code === "BINARY_NOT_FOUND" ? "unsupported" : "unavailable",
      );
    }
  });
}
