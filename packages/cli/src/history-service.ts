import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import {
  buildForecastV1,
  historyEventsFromSnapshot,
  type ForecastMode,
  type ProviderId,
  type QuotaForecastV1,
  type QuotaHistoryEventV1,
  type QuotaSnapshot,
} from "@kuota/core";
import { createLocalJsonlJournal, defaultHistoryDirectory, type ReadResult } from "@kuota/history";
import { PROVIDER_METADATA, builtInProviders, readAll, type QuotaProvider } from "@kuota/providers";

const DAY = 86_400_000;

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

export interface CollectResult {
  collected: {
    provider: string;
    status: string;
    written: number;
    duplicates: number;
  }[];
  errors: { code: string }[];
}

export async function collectSnapshots(
  options: {
    directory?: string;
    providers?: readonly QuotaProvider[];
    providerId?: ProviderId;
    now?: Date;
  } = {},
): Promise<CollectResult> {
  const directory = options.directory ?? defaultHistoryDirectory();
  const providers = options.providers ?? builtInProviders();
  const now = options.now ?? new Date();

  const ids = options.providerId ? [options.providerId] : PROVIDER_METADATA.map((m) => m.id);
  const snapshots: readonly QuotaSnapshot[] = await Effect.runPromise(readAll(ids, providers));
  const store = createLocalJsonlJournal({ directory });
  const deviceId = await loadDeviceId(directory);
  const recordedAt = now.toISOString();

  const collected: CollectResult["collected"] = [];
  const errors: CollectResult["errors"] = [];

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
    await store.applyRetention(now);
  } catch {
    // non-fatal
  }

  return { collected, errors };
}

export async function queryHistory(
  options: {
    directory?: string;
    from?: string;
    to?: string;
    provider?: string;
    windowId?: string;
  } = {},
): Promise<ReadResult> {
  const directory = options.directory ?? defaultHistoryDirectory();
  const now = new Date();
  const to = options.to ?? now.toISOString();
  const from = options.from ?? new Date(now.getTime() - 7 * DAY).toISOString();

  const store = createLocalJsonlJournal({ directory });
  return store.readAll({
    from,
    to,
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.windowId ? { windowId: options.windowId } : {}),
  });
}

export async function queryForecasts(
  options: {
    directory?: string;
    provider?: string;
    windowId?: string;
    mode?: ForecastMode;
    now?: Date;
  } = {},
): Promise<{ forecasts: QuotaForecastV1[]; invalidLines: number }> {
  const directory = options.directory ?? defaultHistoryDirectory();
  const end = options.now ?? new Date();
  const mode = options.mode ?? "all-window";

  const store = createLocalJsonlJournal({ directory });
  const result = await store.readAll({
    from: new Date(end.getTime() - 30 * DAY).toISOString(),
    to: end.toISOString(),
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.windowId ? { windowId: options.windowId } : {}),
  });

  const keys = new Map<string, { provider: string; windowId: string }>();
  for (const e of result.events as QuotaHistoryEventV1[]) {
    if (e.kind === "quota_observed") keys.set(`${e.provider}\u0000${e.windowId}`, e);
  }

  const forecasts = [...keys.values()]
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.windowId.localeCompare(b.windowId))
    .map((k) =>
      buildForecastV1({
        now: end,
        provider: k.provider,
        windowId: k.windowId,
        observations: result.events,
        mode,
      }),
    );

  return { forecasts, invalidLines: result.invalidLines };
}
