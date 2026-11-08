import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { PacedProgress } from "../paced-progress.js";
import {
  calculatePace,
  resolveIdealPace,
  windowProfile,
  getProviderMeta,
  formatCurrencyAmount,
  type QuotaSnapshot,
} from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";
import { Wallet, ShieldCheck } from "lucide-react";

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
  const meta = getProviderMeta(currentId);

  const hasBalance = Boolean(snapshot?.balance && snapshot.balance.balances.length > 0);
  const hasWindows = Boolean(snapshot && snapshot.windows.length > 0);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Provider Detail: {meta.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Rate limits, reset semantics, and financial wallet balance telemetry.
          </p>
        </div>

        {/* Provider switch buttons */}
        <div className="flex flex-wrap gap-1.5">
          {snapshots.map((s) => {
            const m = getProviderMeta(s.provider);
            const isSelected = s.provider === currentId;
            return (
              <button
                key={s.provider}
                type="button"
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 shadow-xs font-semibold"
                    : "bg-slate-200/60 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800/80 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
                onClick={() => onSelectProvider?.(s.provider)}
              >
                <ProviderIcon provider={s.provider} size={13} />
                <span>{m.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Balance / Wallet Section if present */}
            {hasBalance && snapshot.balance && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                    <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span>Prepaid Credit &amp; Wallet Balances</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                    Current funds, cash vs granted credit breakdown, and usage limits.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 dark:border-zinc-800">
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Currency
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Total Balance
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Paid Cash
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Granted
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Usage
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium text-right">
                          Limit
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-zinc-800/60">
                      {snapshot.balance.balances.map((b, idx) => (
                        <TableRow key={`${b.currency}-${idx}`}>
                          <TableCell className="font-semibold text-slate-800 dark:text-zinc-200">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-slate-300 dark:border-zinc-700"
                            >
                              {b.currency}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                            {formatCurrencyAmount(b.totalBalance, b.currency)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-zinc-300 font-mono text-xs">
                            {formatCurrencyAmount(b.toppedUpBalance, b.currency)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-zinc-300 font-mono text-xs">
                            {formatCurrencyAmount(b.grantedBalance, b.currency)}
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-zinc-400 font-mono text-xs">
                            {formatCurrencyAmount(b.usage, b.currency)}
                          </TableCell>
                          <TableCell className="text-right text-slate-500 dark:text-zinc-400 font-mono text-xs">
                            {formatCurrencyAmount(b.limit, b.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Quota Windows Table if present */}
            {hasWindows && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                    <ProviderIcon provider={snapshot.provider} size={18} />
                    <span>{meta.name} Quota Windows</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                    Detailed percentage utilization and cycle reset boundaries.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 dark:border-zinc-800">
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Window ID
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Used %
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Remaining %
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Reset At
                        </TableHead>
                        <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                          Progress
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-zinc-800/60">
                      {snapshot.windows.map((w) => {
                        const pace = resolveIdealPace(w, snapshot.provider, new Date());

                        return (
                          <TableRow key={w.windowId}>
                            <TableCell className="font-mono text-xs text-slate-800 dark:text-zinc-200">
                              {w.windowId}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700 dark:text-zinc-300">
                              {w.usedPercent?.toFixed(1) ?? "—"}%
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100">
                              {w.remainingPercent?.toFixed(1) ?? "—"}%
                            </TableCell>
                            <TableCell className="text-slate-500 dark:text-zinc-400 text-xs">
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
            )}
          </div>

          {/* Metadata & Provenance Card */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Provenance &amp; Diagnostics</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Technical acquisition details &amp; probe parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Status</span>
                <Badge
                  variant="outline"
                  className={
                    snapshot.status === "ok"
                      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]"
                      : "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px]"
                  }
                >
                  {snapshot.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Category</span>
                <span className="text-slate-800 dark:text-zinc-300 font-medium capitalize">
                  {meta.category.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Billing Model</span>
                <span className="text-slate-800 dark:text-zinc-300 capitalize">
                  {meta.billingModel}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Source Method</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-zinc-300">
                  {snapshot.source}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Observed At</span>
                <span className="text-slate-800 dark:text-zinc-300">
                  {new Date(snapshot.fetchedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-zinc-400">Error Code</span>
                <span className="text-slate-800 dark:text-zinc-300 font-mono">
                  {snapshot.errorCode ?? "None"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
