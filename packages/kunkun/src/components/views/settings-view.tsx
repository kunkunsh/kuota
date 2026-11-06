import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Clock, HardDrive } from "lucide-react";

export function SettingsView() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Settings & Sampling</h2>
        <p className="text-xs text-zinc-400">
          Local scheduler parameters, TTL caching policies, and storage retention.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Sampling Cadence</span>
            </CardTitle>
            <CardDescription>Frequency of automated background quota checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <div>
                <div className="font-medium text-zinc-200">Adaptive Sampling</div>
                <div className="text-[11px] text-zinc-400">
                  15 min while active coding, 60 min background
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <div>
                <div className="font-medium text-zinc-200">Sleeping Device Mode</div>
                <div className="text-[11px] text-zinc-400">
                  Skip checks on lid close; no catch-up synthetic events
                </div>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-zinc-200">429 Rate Limit Cooldown</div>
                <div className="text-[11px] text-zinc-400">
                  Enforce strict 15-minute wait before retry
                </div>
              </div>
              <Badge variant="outline">Enforced</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>Local Storage & Retention</span>
            </CardTitle>
            <CardDescription>Disk space policy for historical JSONL events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-300">Retention Horizon</span>
              <span className="font-medium text-zinc-100">400 days (local JSONL)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-300">Partition Strategy</span>
              <span className="font-medium text-zinc-100">UTC Day (events-YYYY-MM-DD.jsonl)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-300">Max Partition File Size</span>
              <span className="font-medium text-zinc-100">16 MiB with auto-rotation</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
