import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { AnimatedCodeBlock } from "../ui/animated-code-block.js";
import { HardDrive, Cloud, Users, ShieldCheck } from "lucide-react";

export function DataSyncView() {
  const [localHistory, setLocalHistory] = React.useState(true);
  const [privateSync, setPrivateSync] = React.useState(false);
  const [researchPool, setResearchPool] = React.useState(false);

  const samplePayload = {
    schemaVersion: 1,
    kind: "quota_observed",
    eventId: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    observedAt: "2026-11-06T01:00:00.000Z",
    recordedAt: "2026-11-06T01:00:05.000Z",
    provider: "claude",
    accountScope: null,
    deviceId: "<redacted-on-export>",
    windowId: "weekly.all",
    epochId: "2026-11-10T00:00:00.000Z",
    semantics: "fixed",
    startAt: "2026-11-03T00:00:00.000Z",
    resetAt: "2026-11-10T00:00:00.000Z",
    usedPercent: 42.5,
    remainingPercent: 57.5,
    source: "claude-oauth-usage",
    state: "ok",
    errorCode: null,
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          Data, Sync & Privacy Center
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Independent privacy channels for local journal, personal sync, and research pool.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Local Journal */}
        <Card className={localHistory ? "border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/60" : "opacity-75"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Local Journal</CardTitle>
              </div>
              <Badge variant={localHistory ? "success" : "outline"}>
                {localHistory ? "Active" : "Disabled"}
              </Badge>
            </div>
            <CardDescription className="text-slate-500 dark:text-zinc-400">Append-only JSONL files on this Mac</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-zinc-400">
              Stores raw timestamped stock percentages partitioned by UTC day. No credentials or
              tokens saved.
            </p>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
              ~/Library/Application Support/kuota/history
            </div>
          </CardContent>
        </Card>

        {/* Private Cloud Sync */}
        <Card className={privateSync ? "border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/60" : "opacity-75"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Private Cloud Sync</CardTitle>
              </div>
              <Badge variant={privateSync ? "default" : "outline"}>
                {privateSync ? "Enabled" : "Off"}
              </Badge>
            </div>
            <CardDescription className="text-slate-500 dark:text-zinc-400">Multi-device quota sync</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-zinc-400">
              Syncs your snapshots between your personal machines. Hot data retained 14 days in D1.
            </p>
            <button
              type="button"
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              onClick={() => setPrivateSync(!privateSync)}
            >
              {privateSync ? "Disable Private Sync" : "Enable Private Sync (Opt-in)"}
            </button>
          </CardContent>
        </Card>

        {/* Anonymous Research Pool */}
        <Card className={researchPool ? "border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/60" : "opacity-75"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Research Pool</CardTitle>
              </div>
              <Badge variant={researchPool ? "default" : "outline"}>
                {researchPool ? "Participating" : "Off"}
              </Badge>
            </div>
            <CardDescription className="text-slate-500 dark:text-zinc-400">Independent research consent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-zinc-400">
              Separate opt-in: contributes anonymized percent intervals to public community
              benchmarks.
            </p>
            <button
              type="button"
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              onClick={() => setResearchPool(!researchPool)}
            >
              {researchPool ? "Withdraw from Research" : "Contribute to Research (Opt-in)"}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Payload Inspector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Sanitized Payload Inspector</CardTitle>
          <CardDescription className="text-slate-500 dark:text-zinc-400">
            Exact JSON structure of normalized events. Secrets, tokens, and system paths are
            strictly excluded by Effect Schema validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatedCodeBlock code={JSON.stringify(samplePayload, null, 2)} language="json" />
        </CardContent>
      </Card>
    </div>
  );
}
