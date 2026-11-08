import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";
import {
  buildForecastV1,
  calculatePace,
  historyEventsFromSnapshot,
  windowProfile,
  type ForecastMode,
  type ProviderId,
  type QuotaHistoryEventV1,
  type QuotaSnapshot,
} from "@kuota/core";
import { createLocalJsonlJournal, defaultHistoryDirectory } from "@kuota/history";
import { PROVIDER_METADATA, isProviderId, readAll, type QuotaProvider } from "@kuota/providers";

export interface CliRuntime {
  /** Journal directory. Default: $KUOTA_HISTORY_DIR or the platform data directory. */
  directory?: string;
  now?: () => Date;
  deviceId?: string;
}

interface CliOutputLike {
  writeStdout(value: string): void;
  writeStderr(value: string): void;
}

async function loadDeviceId(directory: string): Promise<string> {
  const path = join(directory, "device-id");
  try {
    const existing = (await readFile(path, "utf8")).trim();
    if (/^[0-9a-f-]{36}$/.test(existing)) return existing;
  } catch {
    // create below
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  await writeFile(path, id, { mode: 0o600 });
  return id;
}

const DAY = 86_400_000;

export function historyCommands(
  output: CliOutputLike,
  providers: readonly QuotaProvider[],
  runtime: CliRuntime,
  setExit: (code: number) => void,
) {
  const now = () => (runtime.now ?? (() => new Date()))();
  const directory = runtime.directory ?? defaultHistoryDirectory();
  const journal = () => createLocalJsonlJournal({ directory });
  const emit = (json: boolean, value: Record<string, unknown>, human: () => string) =>
    output.writeStdout(
      json
        ? JSON.stringify({ schemaVersion: 1, generatedAt: now().toISOString(), ...value })
        : human(),
    );
  const fail = (json: boolean, code: string, exit = 2) => {
    setExit(exit);
    if (json) emit(true, { errors: [{ code }] }, () => "");
    else output.writeStderr(`Error: ${code}`);
  };
  const provSelector = (
    provider: Option.Option<string>,
    json: boolean,
  ): ProviderId | null | "bad" => {
    const value = Option.getOrUndefined(provider);
    if (value === undefined) return null;
    if (!isProviderId(value)) {
      fail(json, "UNKNOWN_PROVIDER");
      return "bad";
    }
    return value;
  };
  const parseDate = (value: Option.Option<string>, fallback: Date, json: boolean): Date | null => {
    const raw = Option.getOrUndefined(value);
    if (raw === undefined) return fallback;
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) {
      fail(json, "INVALID_DATE");
      return null;
    }
    return parsed;
  };
  const provider = Options.optional(Options.text("provider"));
  const windowOpt = Options.optional(Options.text("window"));
  const json = Options.boolean("json");

  const collect = Command.make(
    "collect",
    {
      once: Options.boolean("once"),
      daemon: Options.boolean("daemon"),
      interval: Options.withDefault(Options.integer("interval"), 15),
      provider,
      json,
    },
    ({ once, daemon, interval, provider: p, json: asJson }) =>
      Effect.gen(function* () {
        if (!once && !daemon) return fail(asJson, "ONCE_REQUIRED");
        const selected = provSelector(p, asJson);
        if (selected === "bad") return;
        const ids = selected ? [selected] : PROVIDER_METADATA.map((m) => m.id);

        const runBatch = async () => {
          const snapshots: readonly QuotaSnapshot[] = await Effect.runPromise(
            readAll(ids, providers),
          );
          const store = journal();
          const deviceId = runtime.deviceId ?? (await loadDeviceId(directory));
          const recordedAt = now().toISOString();
          const collected: {
            provider: string;
            status: string;
            written: number;
            duplicates: number;
          }[] = [];
          const errors: { code: string }[] = [];
          for (const snapshot of snapshots) {
            const events = historyEventsFromSnapshot(snapshot, {
              deviceId,
              accountScope: null,
              recordedAt,
            });
            try {
              const result = await store.append(events);
              collected.push({ provider: snapshot.provider, status: snapshot.status, ...result });
            } catch {
              errors.push({ code: "JOURNAL_WRITE_FAILED" });
            }
          }
          try {
            await store.applyRetention(now());
          } catch {
            // ignore
          }
          return { collected, errors };
        };

        const firstResult = yield* Effect.promise(runBatch);
        if (firstResult.errors.length > 0) setExit(1);
        emit(asJson, firstResult, () =>
          firstResult.collected
            .map(
              (c) => `${c.provider}: ${c.status}, ${c.written} written, ${c.duplicates} duplicate`,
            )
            .join("\n"),
        );

        if (daemon) {
          if (!asJson) {
            output.writeStdout(
              `[kuota daemon] Scheduled periodic snapshot every ${interval} minutes. Press Ctrl+C to stop.`,
            );
          }
          yield* Effect.promise(
            () =>
              new Promise<void>((resolve) => {
                const timer = setInterval(
                  async () => {
                    try {
                      const res = await runBatch();
                      if (!asJson) {
                        output.writeStdout(
                          `[${new Date().toLocaleTimeString()}] Collected snapshots: ${res.collected.map((c) => `${c.provider}(${c.written})`).join(", ")}`,
                        );
                      }
                    } catch {
                      // non-fatal in daemon
                    }
                  },
                  Math.max(1, interval) * 60_000,
                );

                const stop = () => {
                  clearInterval(timer);
                  resolve();
                };
                process.on("SIGINT", stop);
                process.on("SIGTERM", stop);
              }),
          );
        }
      }),
  );

  const history = Command.make(
    "history",
    {
      provider,
      window: windowOpt,
      from: Options.optional(Options.text("from")),
      to: Options.optional(Options.text("to")),
      json,
    },
    ({ provider: p, window: w, from, to, json: asJson }) =>
      Effect.gen(function* () {
        const selected = provSelector(p, asJson);
        if (selected === "bad") return;
        const end = parseDate(to, now(), asJson);
        const start = end && parseDate(from, new Date(end.getTime() - 7 * DAY), asJson);
        if (!end || !start) return;
        const result = yield* Effect.promise(() =>
          journal().readAll({
            from: start.toISOString(),
            to: end.toISOString(),
            ...(selected ? { provider: selected } : {}),
            ...(Option.isSome(w) ? { windowId: w.value } : {}),
          }),
        );
        emit(
          asJson,
          {
            from: start.toISOString(),
            to: end.toISOString(),
            events: result.events,
            invalidLines: result.invalidLines,
          },
          () => `${result.events.length} events (${result.invalidLines} invalid lines skipped)`,
        );
      }),
  );

  const forecast = Command.make(
    "forecast",
    {
      provider,
      window: windowOpt,
      mode: Options.withDefault(Options.text("mode"), "all-window"),
      json,
    },
    ({ provider: p, window: w, mode, json: asJson }) =>
      Effect.gen(function* () {
        const selected = provSelector(p, asJson);
        if (selected === "bad") return;
        if (mode !== "all-window" && mode !== "recent-activity")
          return fail(asJson, "INVALID_MODE");
        const end = now();
        const result = yield* Effect.promise(() =>
          journal().readAll({
            from: new Date(end.getTime() - 30 * DAY).toISOString(),
            to: end.toISOString(),
            ...(selected ? { provider: selected } : {}),
            ...(Option.isSome(w) ? { windowId: w.value } : {}),
          }),
        );
        const keys = new Map<string, { provider: string; windowId: string }>();
        for (const e of result.events as QuotaHistoryEventV1[]) {
          if (e.kind === "quota_observed") keys.set(`${e.provider}\u0000${e.windowId}`, e);
        }
        const forecasts = [...keys.values()]
          .sort(
            (a, b) => a.provider.localeCompare(b.provider) || a.windowId.localeCompare(b.windowId),
          )
          .map((k) =>
            buildForecastV1({
              now: end,
              provider: k.provider,
              windowId: k.windowId,
              observations: result.events,
              mode: mode as ForecastMode,
            }),
          );
        emit(
          asJson,
          { forecasts, invalidLines: result.invalidLines },
          () =>
            forecasts
              .map(
                (f) =>
                  `${f.provider}/${f.windowId}: ${f.quality}${f.exhaustedAt ? `, exhausts ${f.exhaustedAt}` : ""}`,
              )
              .join("\n") || "no history",
        );
      }),
  );

  const pace = Command.make("pace", { provider, json }, ({ provider: p, json: asJson }) =>
    Effect.gen(function* () {
      const selected = provSelector(p, asJson);
      if (selected === "bad") return;
      const ids = selected ? [selected] : PROVIDER_METADATA.map((m) => m.id);
      const snapshots: readonly QuotaSnapshot[] = yield* readAll(ids, providers);
      const at = now();
      const rows = snapshots.flatMap((snapshot) =>
        snapshot.windows.map((window) => {
          const profile = windowProfile(snapshot.provider, window.windowId, window.resetAt, at);
          const reset = window.resetAt ? new Date(window.resetAt) : null;
          const start =
            reset && profile.durationMs !== null
              ? new Date(reset.getTime() - profile.durationMs)
              : null;
          const result = calculatePace({
            now: at,
            startAt: start,
            resetAt: reset,
            usedPercent: window.usedPercent,
            semantics: profile.semantics,
            startSource: start ? "inferred" : "unknown",
          });
          return {
            provider: snapshot.provider,
            windowId: window.windowId,
            semantics: profile.semantics,
            pace: result,
            reason: result ? null : "WINDOW_NOT_PROVEN_FIXED",
          };
        }),
      );
      emit(asJson, { pace: rows }, () =>
        rows
          .map(
            (r) =>
              `${r.provider}/${r.windowId}: ${r.pace ? `ideal ${r.pace.idealUsedPercent.toFixed(1)}% used, actual ${r.pace.actualUsedPercent}%` : r.reason}`,
          )
          .join("\n"),
      );
    }),
  );

  const inspectOpt = Options.boolean("inspect");
  const limitOpt = Options.withDefault(Options.integer("limit"), 20);

  const snapshot = Command.make(
    "snapshot",
    { provider, inspect: inspectOpt, json },
    ({ provider: p, inspect: asInspect, json: asJson }) =>
      Effect.gen(function* () {
        const selected = provSelector(p, asJson);
        if (selected === "bad") return;
        const ids = selected ? [selected] : PROVIDER_METADATA.map((m) => m.id);
        const snapshots: readonly QuotaSnapshot[] = yield* readAll(ids, providers);
        if (asJson) {
          emit(true, { ...(asInspect ? { inspect: true } : {}), snapshots }, () => "");
          return;
        }
        const lines: string[] = [];
        for (const s of snapshots) {
          lines.push(`Provider: ${s.provider} [${s.status}]`);
          lines.push(`  Source: ${s.source} · Fetched: ${s.fetchedAt}`);
          if (s.errorCode) lines.push(`  Error Code: ${s.errorCode}`);
          for (const w of s.windows) {
            lines.push(
              `  - Window: ${w.windowId} · ${w.usedPercent !== null ? `${w.usedPercent}% used` : "unknown"} (${w.remainingPercent !== null ? `${w.remainingPercent}% remaining` : "unknown"})${w.resetAt ? ` · resets ${w.resetAt}` : ""}`,
            );
            if (asInspect) {
              const profile = windowProfile(s.provider, w.windowId, w.resetAt);
              lines.push(
                `      [inspect] semantics: ${profile.semantics} | duration: ${profile.durationMs ? `${profile.durationMs / 3_600_000}h` : "unspecified"}`,
              );
            }
          }
        }
        output.writeStdout(lines.join("\n"));
      }),
  );

  const snapshotsCmd = Command.make(
    "snapshots",
    { limit: limitOpt, provider, window: windowOpt, json },
    ({ limit, provider: p, window: w, json: asJson }) =>
      Effect.gen(function* () {
        const selected = provSelector(p, asJson);
        if (selected === "bad") return;
        const end = now();
        const result = yield* Effect.promise(() =>
          journal().readAll({
            from: new Date(end.getTime() - 30 * DAY).toISOString(),
            to: end.toISOString(),
            ...(selected ? { provider: selected } : {}),
            ...(Option.isSome(w) ? { windowId: w.value } : {}),
          }),
        );
        const sorted = [...(result.events as QuotaHistoryEventV1[])]
          .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
          .slice(0, Math.max(1, limit));

        if (asJson) {
          emit(true, { total: sorted.length, snapshots: sorted }, () => "");
          return;
        }

        if (sorted.length === 0) {
          output.writeStdout("No recorded snapshot events found.");
          return;
        }

        const lines = [
          "RECORDED AT (UTC)          PROVIDER     WINDOW       USED %    KIND",
          "-------------------------------------------------------------------------",
          ...sorted.map((e) => {
            const time = e.recordedAt.padEnd(26);
            const prov = e.provider.padEnd(12);
            const win = ("windowId" in e ? (e.windowId as string) : "-").padEnd(12);
            const used = (
              "usedPercent" in e && e.usedPercent !== null ? `${e.usedPercent}%` : "-"
            ).padEnd(9);
            return `${time} ${prov} ${win} ${used} ${e.kind}`;
          }),
        ];
        output.writeStdout(lines.join("\n"));
      }),
  );

  return [collect, history, forecast, pace, snapshot, snapshotsCmd] as const;
}
