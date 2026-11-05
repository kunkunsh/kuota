import { Effect } from "effect";
import { makeUnavailableSnapshot, type ProviderId, type QuotaSnapshot } from "@kuota/core";
import { readCodex } from "./codex/index.js";
import { readAntigravity } from "./antigravity/index.js";
import { readClaude } from "./claude/index.js";

export interface QuotaProvider {
  id: ProviderId;
  label: string;
  read: () => Effect.Effect<QuotaSnapshot, unknown>;
}

export interface ProviderMetadata {
  id: ProviderId;
  label: string;
  implemented: boolean;
  source: string;
}

export const PROVIDER_METADATA: readonly ProviderMetadata[] = [
  { id: "codex", label: "OpenAI Codex", implemented: true, source: "codex-app-server" },
  { id: "claude", label: "Claude Code", implemented: true, source: "claude-oauth-usage" },
  { id: "antigravity", label: "Google Antigravity", implemented: true, source: "agy-cli-print" },
];

/** Static names are extensible to runtime manifests in the later plugin phase. */
export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_METADATA.some((provider) => provider.id === value);
}

export function builtInProviders(): QuotaProvider[] {
  return [
    { id: "codex", label: "OpenAI Codex", read: () => readCodex() },
    { id: "claude", label: "Claude Code", read: () => readClaude() },
    { id: "antigravity", label: "Google Antigravity", read: () => readAntigravity() },
  ];
}

/** One failed adapter never prevents other providers from reporting. */
export function readAll(
  ids: readonly ProviderId[],
  providers: readonly QuotaProvider[] = builtInProviders(),
): Effect.Effect<readonly QuotaSnapshot[]> {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  return Effect.all(
    ids.map((id) => {
      const provider = byId.get(id);
      if (!provider)
        return Effect.succeed(makeUnavailableSnapshot(id, "NOT_REGISTERED", "unsupported"));
      return provider
        .read()
        .pipe(
          Effect.catchAllCause(() =>
            Effect.succeed(makeUnavailableSnapshot(id, "PROVIDER_FAILED")),
          ),
        );
    }),
    { concurrency: 3 },
  );
}
