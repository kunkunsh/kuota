import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { Bell, AlertTriangle } from "lucide-react";

export function AlertsView() {
  const rules = [
    {
      id: "1",
      target: "Claude (weekly.all)",
      condition: "Remaining quota < 20%",
      channel: "Kunkun Notification",
      status: "Active",
    },
    {
      id: "2",
      target: "Codex (primary)",
      condition: "Usage pace > 1.4x ideal time budget",
      channel: "Banner Toast",
      status: "Active",
    },
    {
      id: "3",
      target: "Any Provider",
      condition: "Provider 429 rate limit triggered",
      channel: "System Alert",
      status: "Active",
    },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          Alerts & Quota Automation
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Proactive notifications when consumption pace or rate limits require attention.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Configured Alert Rules</CardTitle>
          <CardDescription className="text-slate-500 dark:text-zinc-400">Evaluated locally during periodic snapshot collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 dark:border-zinc-800">
                <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">Target Window</TableHead>
                <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">Trigger Condition</TableHead>
                <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">Delivery Channel</TableHead>
                <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200/60 dark:divide-zinc-800/60">
              {rules.map((r) => (
                <TableRow key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/30">
                  <TableCell className="font-semibold text-slate-900 dark:text-zinc-200">
                    <div className="flex items-center space-x-2">
                      <ProviderIcon
                        provider={
                          r.target.toLowerCase().includes("claude")
                            ? "claude"
                            : r.target.toLowerCase().includes("codex")
                              ? "codex"
                              : "any"
                        }
                        size={15}
                      />
                      <span>{r.target}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-zinc-300">{r.condition}</TableCell>
                  <TableCell className="text-slate-500 dark:text-zinc-400">{r.channel}</TableCell>
                  <TableCell>
                    <Badge variant="success">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
