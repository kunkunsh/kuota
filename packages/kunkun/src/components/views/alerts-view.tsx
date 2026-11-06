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
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Alerts & Quota Automation
        </h2>
        <p className="text-xs text-zinc-400">
          Proactive notifications when consumption pace or rate limits require attention.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Configured Alert Rules</CardTitle>
          <CardDescription>Evaluated locally during periodic snapshot collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target Window</TableHead>
                <TableHead>Trigger Condition</TableHead>
                <TableHead>Delivery Channel</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold text-zinc-200">
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
                  <TableCell className="text-zinc-300">{r.condition}</TableCell>
                  <TableCell className="text-zinc-400">{r.channel}</TableCell>
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
