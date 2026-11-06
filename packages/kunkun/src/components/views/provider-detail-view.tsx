import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { PacedProgress } from "../paced-progress.js";
import { calculatePace, windowProfile, type QuotaSnapshot } from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";

export function ProviderDetailView({
  snapshots,
  selectedId,
  onSelectProvider,
}: {
  snapshots: readonly QuotaSnapshot[];
  selectedId?: string;
  onSelectProvider?: (id: string) => void;
}) {
  const currentId = selectedId ?? snapshots[0]?.provider ?? "codex";
  const snapshot = snapshots.find((s) => s.provider === currentId);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Provider Detail</h2>
          <p className="text-xs text-zinc-400">
            Window semantics, active rate limits, and provenance inspection per provider.
          </p>
        </div>

        {/* Provider switch buttons */}
        <div className="flex space-x-2">
          {snapshots.map((s) => (
            <button
              key={s.provider}
              type="button"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                s.provider === currentId
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                  : "bg-zinc-900/60 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
              }`}
              onClick={() => onSelectProvider?.(s.provider)}
            >
              <ProviderIcon provider={s.provider} size={14} />
              <span>{s.provider}</span>
            </button>
          ))}
        </div>
      </div>

      {snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Windows Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold capitalize flex items-center space-x-2">
                <ProviderIcon provider={snapshot.provider} size={18} />
                <span>{snapshot.provider} Windows</span>
              </CardTitle>
              <CardDescription>
                Detailed percentage utilization and cycle reset boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Window ID</TableHead>
                    <TableHead>Used %</TableHead>
                    <TableHead>Remaining %</TableHead>
                    <TableHead>Reset At</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.windows.map((w) => {
                    const profile = windowProfile(snapshot.provider, w.windowId, w.resetAt);
                    const reset = w.resetAt ? new Date(w.resetAt) : null;
                    const start =
                      reset && profile.durationMs !== null
                        ? new Date(reset.getTime() - profile.durationMs)
                        : null;
                    const pace = calculatePace({
                      now: new Date(),
                      startAt: start,
                      resetAt: reset,
                      usedPercent: w.usedPercent,
                      semantics: profile.semantics,
                      startSource: start ? "inferred" : "unknown",
                    });

                    return (
                      <TableRow key={w.windowId}>
                        <TableCell className="font-medium text-zinc-200">{w.windowId}</TableCell>
                        <TableCell>{w.usedPercent?.toFixed(1) ?? "—"}%</TableCell>
                        <TableCell>{w.remainingPercent?.toFixed(1) ?? "—"}%</TableCell>
                        <TableCell className="text-zinc-400">
                          {w.resetAt ? new Date(w.resetAt).toLocaleTimeString() : "—"}
                        </TableCell>
                        <TableCell className="w-36">
                          <PacedProgress
                            remainingPercent={w.remainingPercent}
                            idealRemainingPercent={pace ? 100 - pace.idealUsedPercent : null}
                            quality={pace?.quality}
                            heightClass="h-2"
                            showLegend={false}
                            barColor={
                              currentId === "claude"
                                ? "bg-[#da7756]"
                                : currentId === "codex"
                                  ? "bg-[#5c82ff]"
                                  : "bg-emerald-500"
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Provenance & Status</CardTitle>
              <CardDescription>Technical acquisition details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                <span className="text-zinc-400">Status</span>
                <Badge variant={snapshot.status === "ok" ? "success" : "destructive"}>
                  {snapshot.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                <span className="text-zinc-400">Source Method</span>
                <span className="font-mono text-[11px] text-zinc-300">{snapshot.source}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                <span className="text-zinc-400">Observed UTC</span>
                <span className="text-zinc-300">
                  {new Date(snapshot.fetchedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800">
                <span className="text-zinc-400">Error Code</span>
                <span className="text-zinc-300 font-mono">{snapshot.errorCode ?? "None"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
