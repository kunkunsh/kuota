import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { TokenBarChart } from "../charts/token-bar-chart.js";
import { SpendingRing } from "../charts/spending-ring.js";

export function UsageView() {
  const models = [
    {
      model: "claude-3-7-sonnet",
      inputTokens: 1250000,
      outputTokens: 380000,
      cacheReadTokens: 4500000,
      cacheWriteTokens: 600000,
      estimatedUsd: 14.85,
    },
    {
      model: "gpt-4o",
      inputTokens: 850000,
      outputTokens: 210000,
      cacheReadTokens: 1200000,
      cacheWriteTokens: 300000,
      estimatedUsd: 6.2,
    },
    {
      model: "gemini-2.5-pro",
      inputTokens: 2100000,
      outputTokens: 490000,
      cacheReadTokens: 6200000,
      cacheWriteTokens: 850000,
      estimatedUsd: 11.4,
    },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Usage & Value</h2>
        <p className="text-xs text-zinc-400">Attributed token volume and API-equivalent value.</p>
      </div>

      <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300">
        <span className="font-semibold">Notice:</span> API-equivalent value is a local workload
        estimate based on public API rates, not your actual vendor subscription bill.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Estimated Value</CardDescription>
            <CardTitle className="text-xl font-bold text-zinc-100">$32.45</CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-zinc-400">
            Based on 16.2M combined tokens this cycle
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cache Read Hit Rate</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-400">73.5%</CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-zinc-400">
            Prompt caching saved approximately $48.20
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Generated Tokens</CardDescription>
            <CardTitle className="text-xl font-bold text-zinc-100">1.08M</CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-zinc-400">
            Across 3 active model families
          </CardContent>
        </Card>
      </div>

      {/* Kokonut UI: Spending Ring Hero Dial + Detailed Model Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Rotary Spending Ring */}
        <div className="flex justify-center">
          <SpendingRing title="Cycle spending by model" className="w-full" />
        </div>

        {/* Model Breakdown Bar Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-[#111113] border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-100">Model Breakdown</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Token distribution: input vs output vs cached tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TokenBarChart items={models} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
