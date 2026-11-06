import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { ShieldCheck, BarChart3 } from "lucide-react";
import { ProviderIcon } from "../ui/provider-icon.js";

export function BenchmarksView() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Community Benchmarks
          </h2>
          <Badge variant="outline" className="flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>k ≥ 50 Anonymity</span>
          </Badge>
        </div>
        <p className="text-xs text-zinc-400">
          Aggregated, voluntary cohort distributions for effective subscription throughput.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-2 text-xs text-zinc-400">
        <div className="font-semibold text-zinc-200">K-Anonymity & Suppression Policy</div>
        <p>
          Cohort metrics are only displayed when at least 50 independent subscribers have
          voluntarily contributed comparable workload data. No raw traces, device identifiers, or
          individual user points are published.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center space-x-2">
            <ProviderIcon provider="claude" size={16} />
            <span>Claude Pro/Team Weekly Quota Cohort (k=142)</span>
          </CardTitle>
          <CardDescription>Observed effective token throughput before rate limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-900/60 p-3 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">
                25th Percentile
              </div>
              <div className="text-base font-bold text-zinc-200 mt-1">12.5M tokens</div>
            </div>
            <div className="rounded-lg bg-zinc-900/60 p-3 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Median (p50)</div>
              <div className="text-base font-bold text-emerald-400 mt-1">18.2M tokens</div>
            </div>
            <div className="rounded-lg bg-zinc-900/60 p-3 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">
                75th Percentile
              </div>
              <div className="text-base font-bold text-zinc-200 mt-1">26.0M tokens</div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500">
            * Effective tokens vary significantly based on prompt caching hit rate and reasoning
            depth.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
