import { homedir } from "node:os";
import { mkdir, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Either } from "effect";
import { decodeHistoryEvent, type QuotaHistoryEventV1 } from "@kuota/core";

export interface ReadOptions {
  from: string;
  to: string;
  provider?: string;
  windowId?: string;
}

export interface ReadResult {
  events: QuotaHistoryEventV1[];
  /** Lines that were truncated, not JSON, or failed strict schema validation. */
  invalidLines: number;
}

export interface JournalStore {
  append(events: readonly QuotaHistoryEventV1[]): Promise<{ written: number; duplicates: number }>;
  read(options: ReadOptions): AsyncIterable<QuotaHistoryEventV1>;
  readAll(options: ReadOptions): Promise<ReadResult>;
  /** Deletes whole UTC-day partitions older than `retentionDays`. Returns files removed. */
  applyRetention(now?: Date): Promise<number>;
}

export interface JournalOptions {
  directory: string;
  /** Rotate to `events-DATE.N.jsonl` beyond this size. Default 16 MiB. */
  maxFileBytes?: number;
  /** Default 400 days. */
  retentionDays?: number;
  /** fsync after each append batch. Default true. */
  fsync?: boolean;
  lockStaleMs?: number;
  lockTimeoutMs?: number;
}

// Only matches names we generate; provider-supplied strings never reach the filesystem.
const FILE = /^events-(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.jsonl$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const utcDate = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

async function listParts(directory: string, date?: string) {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const parts: { name: string; date: string; part: number }[] = [];
  for (const name of names) {
    const match = FILE.exec(name);
    if (!match || !DATE.test(match[1]!)) continue;
    if (date !== undefined && match[1] !== date) continue;
    parts.push({ name, date: match[1]!, part: match[2] === undefined ? 0 : Number(match[2]) });
  }
  return parts.sort((a, b) => a.date.localeCompare(b.date) || a.part - b.part);
}

function partName(date: string, part: number): string {
  return part === 0 ? `events-${date}.jsonl` : `events-${date}.${part}.jsonl`;
}

async function parseFile(
  path: string,
): Promise<{ events: QuotaHistoryEventV1[]; invalid: number }> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { events: [], invalid: 0 };
  }
  const events: QuotaHistoryEventV1[] = [];
  let invalid = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const decoded = decodeHistoryEvent(JSON.parse(line));
      if (Either.isRight(decoded)) events.push(decoded.right);
      else invalid++;
    } catch {
      invalid++;
    }
  }
  return { events, invalid };
}

export function createLocalJsonlJournal(options: JournalOptions): JournalStore {
  const directory = options.directory;
  const maxFileBytes = options.maxFileBytes ?? 16 * 1024 * 1024;
  const retentionDays = options.retentionDays ?? 400;
  const doSync = options.fsync ?? true;
  const lockStaleMs = options.lockStaleMs ?? 30_000;
  const lockTimeoutMs = options.lockTimeoutMs ?? 15_000;
  const lockPath = join(directory, ".lock");
  let queue: Promise<unknown> = Promise.resolve();

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const deadline = Date.now() + lockTimeoutMs;
    for (;;) {
      try {
        const handle = await open(lockPath, "wx", 0o600);
        await handle.writeFile(String(process.pid));
        await handle.close();
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          // A crashed writer leaves a lock behind; only remove it once clearly stale.
          const info = await stat(lockPath);
          if (Date.now() - info.mtimeMs > lockStaleMs) {
            await rm(lockPath, { force: true });
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() > deadline) throw new Error("JOURNAL_LOCK_TIMEOUT");
        await sleep(5);
      }
    }
    try {
      return await fn();
    } finally {
      await rm(lockPath, { force: true });
    }
  }

  async function appendDate(date: string, events: QuotaHistoryEventV1[]) {
    const parts = await listParts(directory, date);
    const known = new Set<string>();
    for (const part of parts) {
      for (const event of (await parseFile(join(directory, part.name))).events) {
        known.add(event.eventId);
      }
    }
    const fresh: QuotaHistoryEventV1[] = [];
    let duplicates = 0;
    for (const event of events) {
      if (known.has(event.eventId)) duplicates++;
      else {
        known.add(event.eventId);
        fresh.push(event);
      }
    }
    if (fresh.length === 0) return { written: 0, duplicates };

    let partNumber = parts.length === 0 ? 0 : parts[parts.length - 1]!.part;
    let path = join(directory, partName(date, partNumber));
    let size = 0;
    let endsWithNewline = true;
    try {
      size = (await stat(path)).size;
      if (size > 0) {
        const handle = await open(path, "r");
        const last = Buffer.alloc(1);
        await handle.read(last, 0, 1, size - 1);
        await handle.close();
        endsWithNewline = last[0] === 0x0a;
      }
    } catch {
      size = 0;
    }

    const buckets: string[][] = [[]];
    let current = size;
    for (const event of fresh) {
      const line = JSON.stringify(event) + "\n";
      if (current > 0 && current + line.length > maxFileBytes) {
        buckets.push([]);
        current = 0;
      }
      buckets[buckets.length - 1]!.push(line);
      current += line.length;
    }

    for (const [index, lines] of buckets.entries()) {
      if (index > 0) {
        partNumber += 1;
        path = join(directory, partName(date, partNumber));
        endsWithNewline = true;
      }
      // A truncated trailing line (crash mid-write) is quarantined by terminating it, never rewritten.
      const payload = (endsWithNewline ? "" : "\n") + lines.join("");
      const handle = await open(path, "a", 0o600);
      try {
        await handle.write(payload);
        if (doSync) await handle.sync();
      } finally {
        await handle.close();
      }
    }
    return { written: fresh.length, duplicates };
  }

  async function readAll(opts: ReadOptions): Promise<ReadResult> {
    const fromMs = Date.parse(opts.from);
    const toMs = Date.parse(opts.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) throw new Error("INVALID_RANGE");
    const fromDate = utcDate(opts.from);
    const toDate = utcDate(opts.to);
    const events: QuotaHistoryEventV1[] = [];
    let invalidLines = 0;
    for (const part of await listParts(directory)) {
      if (part.date < fromDate || part.date > toDate) continue;
      const parsed = await parseFile(join(directory, part.name));
      invalidLines += parsed.invalid;
      for (const event of parsed.events) {
        const t = Date.parse(event.observedAt);
        if (t < fromMs || t > toMs) continue;
        if (opts.provider !== undefined && event.provider !== opts.provider) continue;
        if (opts.windowId !== undefined && event.windowId !== opts.windowId) continue;
        events.push(event);
      }
    }
    return { events, invalidLines };
  }

  return {
    append(events) {
      for (const event of events) {
        if (Either.isLeft(decodeHistoryEvent(event)))
          return Promise.reject(new Error("INVALID_HISTORY_EVENT"));
      }
      const run = queue.then(() =>
        withLock(async () => {
          const byDate = new Map<string, QuotaHistoryEventV1[]>();
          for (const event of events) {
            const date = utcDate(event.observedAt);
            byDate.set(date, [...(byDate.get(date) ?? []), event]);
          }
          let written = 0;
          let duplicates = 0;
          for (const [date, list] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
            const result = await appendDate(date, list);
            written += result.written;
            duplicates += result.duplicates;
          }
          return { written, duplicates };
        }),
      );
      queue = run.catch(() => undefined);
      return run;
    },
    readAll,
    async *read(opts) {
      for (const event of (await readAll(opts)).events) yield event;
    },
    async applyRetention(now = new Date()) {
      const cutoffMs =
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (Math.max(1, retentionDays) - 1) * 86_400_000;
      const cutoff = new Date(cutoffMs).toISOString().slice(0, 10);
      return queue.then(() =>
        withLock(async () => {
          let removed = 0;
          for (const part of await listParts(directory)) {
            if (part.date < cutoff) {
              await rm(join(directory, part.name), { force: true });
              removed++;
            }
          }
          return removed;
        }),
      );
    },
  };
}

export function defaultHistoryDirectory(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string {
  if (env.KUOTA_HISTORY_DIR) return env.KUOTA_HISTORY_DIR;
  if (platform === "darwin")
    return join(homedir(), "Library", "Application Support", "kuota", "history");
  return join(env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "kuota", "history");
}
