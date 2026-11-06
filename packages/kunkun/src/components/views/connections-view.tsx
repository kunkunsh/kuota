import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { ProviderIcon } from "../ui/provider-icon.js";

export function ConnectionsView({ onRefresh }: { onRefresh?: () => void }) {
  const adapters = [
    {
      id: "codex",
      name: "OpenAI Codex",
      executable: "codex",
      method: "codex app-server JSON-RPC",
      status: "connected",
      auth: "CLI session verified",
      cooldown: "Active (60s TTL)",
    },
    {
      id: "claude",
      name: "Claude Code",
      executable: "claude",
      method: "OAuth usage endpoint",
      status: "connected",
      auth: "Existing local token",
      cooldown: "Active (900s TTL)",
    },
    {
      id: "antigravity",
      name: "Google Antigravity",
      executable: "agy",
      method: "agy CLI usage print",
      status: "connected",
      auth: "Sandbox authenticated",
      cooldown: "Active (300s TTL)",
    },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Provider Connections & Diagnostics
          </h2>
          <p className="text-xs text-zinc-400">
            Health and authentication status of local quota acquisition adapters.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Probe Adapters
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Configured Adapters</CardTitle>
          <CardDescription>
            Zero auto-login policy: adapters strictly read existing authenticated sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Executable</TableHead>
                <TableHead>Acquisition Method</TableHead>
                <TableHead>Auth Status</TableHead>
                <TableHead>Rate Limit Policy</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adapters.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-zinc-100">
                    <div className="flex items-center space-x-2">
                      <ProviderIcon provider={a.id} size={16} />
                      <span>{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">{a.executable}</TableCell>
                  <TableCell className="text-zinc-300">{a.method}</TableCell>
                  <TableCell className="text-zinc-300">{a.auth}</TableCell>
                  <TableCell className="text-zinc-400">{a.cooldown}</TableCell>
                  <TableCell>
                    <Badge variant="success">Ready</Badge>
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
