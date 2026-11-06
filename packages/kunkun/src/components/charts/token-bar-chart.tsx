import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface ModelUsageItem {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedUsd: number;
}

export function TokenBarChart({
  items,
  className,
}: {
  items: readonly ModelUsageItem[];
  className?: string;
}) {
  const maxTokens = Math.max(
    1,
    ...items.map(
      (it) => it.inputTokens + it.outputTokens + it.cacheReadTokens + it.cacheWriteTokens,
    ),
  );

  return (
    <div className={cn("flex flex-col space-y-3 w-full text-xs", className)}>
      {items.map((item) => {
        const total =
          item.inputTokens + item.outputTokens + item.cacheReadTokens + item.cacheWriteTokens;
        const inPct = (item.inputTokens / maxTokens) * 100;
        const outPct = (item.outputTokens / maxTokens) * 100;
        const cachePct = ((item.cacheReadTokens + item.cacheWriteTokens) / maxTokens) * 100;

        return (
          <div key={item.model} className="flex flex-col space-y-1">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-medium text-zinc-100">{item.model}</span>
              <span className="text-[11px] text-zinc-400">
                {(total / 1000).toFixed(1)}k tokens · ~${item.estimatedUsd.toFixed(2)}{" "}
                <span className="text-[10px] text-zinc-500">(est)</span>
              </span>
            </div>

            {/* Stacked token bar */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="bg-sky-500 h-full"
                style={{ width: `${inPct}%` }}
                title={`Input tokens: ${item.inputTokens.toLocaleString()}`}
              />
              <div
                className="bg-indigo-500 h-full"
                style={{ width: `${outPct}%` }}
                title={`Output tokens: ${item.outputTokens.toLocaleString()}`}
              />
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${cachePct}%` }}
                title={`Cache tokens: ${(item.cacheReadTokens + item.cacheWriteTokens).toLocaleString()}`}
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center space-x-4 text-[10px] text-zinc-400 pt-2 border-t border-zinc-800/60">
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
          <span>Input</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          <span>Output</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Cached</span>
        </span>
      </div>
    </div>
  );
}
