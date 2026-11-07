import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { PROVIDER_CATALOG } from "@kuota/core";
import { Plus, RefreshCw, Key, CheckCircle2 } from "lucide-react";

export function ConnectionsView({ onRefresh }: { onRefresh?: () => void }) {
  const [customModalOpen, setCustomModalOpen] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customEndpoint, setCustomEndpoint] = React.useState("");
  const [customKey, setCustomKey] = React.useState("");
  const [customModel, setCustomModel] = React.useState<"balance" | "subscription">("balance");
  const [customList, setCustomList] = React.useState<
    { name: string; endpoint: string; billingModel: string }[]
  >([]);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customEndpoint.trim()) return;
    setCustomList((prev) => [
      ...prev,
      {
        name: customName.trim(),
        endpoint: customEndpoint.trim(),
        billingModel: customModel,
      },
    ]);
    setCustomName("");
    setCustomEndpoint("");
    setCustomKey("");
    setCustomModalOpen(false);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Provider Connections &amp; Telemetry
          </h2>
          <p className="text-xs text-zinc-400">
            Health and authentication status across local CLI probes and remote API endpoints.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-zinc-700 bg-zinc-900"
            onClick={() => setCustomModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Custom Provider
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Probe All Adapters
          </Button>
        </div>
      </div>

      {/* Modal / Form for Custom Provider */}
      {customModalOpen && (
        <Card className="bg-[#141416] border-emerald-500/40 shadow-xl animate-in fade-in-50 duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Add Custom Model / Relay Provider</span>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-200 text-xs"
                onClick={() => setCustomModalOpen(false)}
              >
                ✕
              </button>
            </CardTitle>
            <CardDescription className="text-xs">
              Connect any OpenAI-compatible API relay, vLLM, Ollama, or custom self-hosted endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCustom} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">
                    Provider Name / ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My relay, Local vLLM"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Billing Model</label>
                  <select
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="balance">Prepaid Balance / Credit ($ / ¥)</option>
                    <option value="subscription">Subscription Quota (% pace)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Endpoint URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.example.com/v1"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">
                    API Key / Token (Masked)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Save &amp; Connect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Catalog Table */}
      <Card className="bg-[#111113] border-zinc-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              Configured Adapters ({PROVIDER_CATALOG.length + customList.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Zero auto-login policy: adapters strictly read existing authenticated sessions or user
              environment keys.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] text-zinc-400 bg-zinc-900">
            Adapter Architecture v2
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400 font-medium">Provider</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Category</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Billing Model</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Acquisition Method</TableHead>
                  <TableHead className="text-zinc-400 font-medium">Auth / Env Key</TableHead>
                  <TableHead className="text-zinc-400 font-medium text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800/60">
                {PROVIDER_CATALOG.map((a) => (
                  <TableRow key={a.id} className="hover:bg-zinc-900/30 transition-colors">
                    <TableCell className="font-semibold text-zinc-100 whitespace-nowrap">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                          <ProviderIcon provider={a.id} size={16} />
                        </div>
                        <div>
                          <div>{a.name}</div>
                          <div className="text-[10px] font-normal text-zinc-500">
                            {a.defaultPlan}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-zinc-800 bg-zinc-900/60"
                      >
                        {a.category === "coding_agent"
                          ? "Coding Agent"
                          : a.category === "aggregator"
                            ? "Aggregator"
                            : "LLM API"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300 whitespace-nowrap">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          a.billingModel === "subscription"
                            ? "bg-blue-950/40 text-blue-400 border border-blue-800/40"
                            : a.billingModel === "hybrid"
                              ? "bg-purple-950/40 text-purple-400 border border-purple-800/40"
                              : "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                        }`}
                      >
                        {a.billingModel === "subscription"
                          ? "Subscription"
                          : a.billingModel === "hybrid"
                            ? "Hybrid Credit"
                            : "Prepaid Wallet"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400 whitespace-nowrap">
                      {a.source}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400 whitespace-nowrap">
                      {a.envKeys.length > 0 ? (
                        <div className="flex items-center space-x-1">
                          <Key className="w-3 h-3 text-zinc-500" />
                          <span>{a.envKeys[0]}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">Local CLI Session</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] text-emerald-400 border-emerald-800/40 bg-emerald-950/30"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1 inline" />
                        Integrated
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Custom Providers */}
                {customList.map((c, i) => (
                  <TableRow key={`custom-${i}`} className="hover:bg-zinc-900/30">
                    <TableCell className="font-semibold text-zinc-100">
                      <div className="flex items-center space-x-2">
                        <ProviderIcon provider="custom" size={16} />
                        <span>{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400">Custom</TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.billingModel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400 truncate max-w-[180px]">
                      {c.endpoint}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400">Custom Key</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px] text-emerald-400">
                        Connected
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
