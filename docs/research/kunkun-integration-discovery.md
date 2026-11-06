# Kunkun integration discovery (K0) — status: INCOMPLETE, BLOCKED ON HK

Date: 2026-11-06. This is the mandatory gate from `docs/superpowers/plans/2026-11-06-kuota-kunkun-integration.md`.

## What was verified

Nothing from a real Kunkun v2.1 checkout. No checkout is available locally and `/Users/hk/Dev` cannot be listed from the sandbox.

## What a public web search reported (unverified, likely legacy Tauri-era API)

- Extension manifest is the `kunkun` block of `package.json` with an explicit `permissions` array.
- Deno/subprocess capability is gated by permissions such as `shell:deno:execute` and `shell:deno:spawn`, exposed through `@kksh/api` (`shell.createDenoCommand`, `shell.createDenoRpcChannel`).
- Declared permissions are shown to users in the store.

None of this is confirmed for v2.1. The plan warns the public repo mixes legacy files and newer material, so **no adapter code has been written** against it.

## Needed from HK to unblock K0

1. Kunkun v2.1 checkout URL/branch/commit (or a local path the agent may read).
2. Confirmation of which runtime path to evaluate: (A) Deno runner with `node:child_process`, (B) host broker, (C) packaged Kuota executable behind an allowlisted subprocess bridge.
3. Permission to run a harmless static `providers.list` plugin.

## Prepared and safe to do after K0

- `@kuota/core`, `@kuota/providers`, `@kuota/history` are platform-split and ready: core is browser-safe (no `node:*`), history is Node-only.
- Browser/WebView must receive only sanitized `QuotaObservation` / `QuotaForecastV1` / history events, never tokens or raw payloads.
- React + shadcn dashboard (K3) should reuse `@kuota/core` forecast and pace functions and the concept gallery with its QA corrections. The gallery images were not readable from this session (`references/gdrive` is blocked by the sandbox), and their mock numbers are not API data.

## Update: Gallery QA read

`docs/design/2026-11-06-kuota-concept-gallery.md` §4 (11 QA corrections) was read from the repo. Key rules for the React slice: one white ideal tick per window max (none if unavailable); rolling windows show `unsupported`, never a fixed forecast; no invented request denominators; named confidence levels, not "72%"; scheduler/notification/launchd controls disabled as "not configured"; first slices are routes 01–05 and 09–10. Only the PNG images themselves remain unread (symlink `references/gdrive` points outside the sandbox).
