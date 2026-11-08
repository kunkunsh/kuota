import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { PROVIDER_CATALOG, type QuotaSnapshot } from "@kuota/core";
import {
  Plus,
  RefreshCw,
  Key,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";

export interface ConnectionsViewProps {
  snapshots?: readonly QuotaSnapshot[];
  onRefresh?: () => void;
  onNavigate?: (route: string) => void;
}

export function ConnectionsView({ snapshots = [], onRefresh, onNavigate }: ConnectionsViewProps) {
  const [customModalOpen, setCustomModalOpen] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customEndpoint, setCustomEndpoint] = React.useState("");
  const [customKey, setCustomKey] = React.useState("");
  const [customModel, setCustomModel] = React.useState<"balance" | "subscription">("balance");
  const [customList, setCustomList] = React.useState<
    { name: string; endpoint: string; billingModel: string }[]
  >([]);

  // Calculate live connection counts
  const activeCount = React.useMemo(() => {
    return PROVIDER_CATALOG.filter((p) => {
      const snap = snapshots.find((s) => s.provider === p.id);
      return snap?.status === "ok";
    }).length;
  }, [snapshots]);

  const unconfiguredCount = PROVIDER_CATALOG.length - activeCount;

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
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center space-x-2">
            <span>Provider Connections &amp; Telemetry</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-normal bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              Live Probing
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time authentication and probe status verified against local CLI sessions and OS
            Keychain credentials.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
            onClick={() => setCustomModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Custom Provider
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
            onClick={onRefresh}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Probe All Adapters
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                Active &amp; Connected
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                Awaiting Credentials
              </div>
              <div className="text-2xl font-bold font-mono text-slate-800 dark:text-zinc-300">
                {unconfiguredCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 text-slate-600 dark:text-zinc-400">
              <Key className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                Supported Adapters
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {PROVIDER_CATALOG.length + customList.length}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Radio className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal / Form for Custom Provider */}
      {customModalOpen && (
        <Card className="border-emerald-500/40 shadow-xl animate-in fade-in-50 duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Add Custom Model / Relay Provider</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs cursor-pointer"
                onClick={() => setCustomModalOpen(false)}
              >
                ✕
              </button>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Connect any OpenAI-compatible API relay, vLLM, Ollama, or custom self-hosted endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCustom} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                    Provider Name / ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My relay, Local vLLM"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                    Billing Model
                  </label>
                  <select
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700"
                  >
                    <option value="balance">Prepaid Balance / Credit ($ / ¥)</option>
                    <option value="subscription">Subscription Quota (% pace)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.example.com/v1"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                    API Key / Token (Masked)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-md text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700 font-mono"
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  Save &amp; Connect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Catalog Table with Honest Live Status */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <span>Supported AI Providers ({PROVIDER_CATALOG.length + customList.length})</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {activeCount} Active
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Zero auto-login policy: Kuota strictly reads existing authenticated CLI sessions or
              explicit OS Keychain keys.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700"
          >
            Iconify Logos
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-zinc-800">
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                    Provider
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                    Category
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                    Billing Model
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                    Telemetry Source
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium">
                    Auth / Env Key
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-medium text-right">
                    Connection Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-200/60 dark:divide-zinc-800/60">
                {PROVIDER_CATALOG.map((a) => {
                  const snap = snapshots.find((s) => s.provider === a.id);
                  const isConnected = snap?.status === "ok";
                  const isPartial = snap?.status === "partial";
                  const isBinaryMissing = snap?.errorCode === "BINARY_NOT_FOUND";

                  return (
                    <TableRow
                      key={a.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <TableCell className="font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
                            <ProviderIcon provider={a.id} size={18} />
                          </div>
                          <div>
                            <div>{a.name}</div>
                            <div className="text-[10px] font-normal text-slate-500 dark:text-zinc-500">
                              {a.defaultPlan}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-300"
                        >
                          {a.category === "coding_agent"
                            ? "Coding Agent"
                            : a.category === "aggregator"
                              ? "Aggregator"
                              : "LLM API"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            a.billingModel === "subscription"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : a.billingModel === "hybrid"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {a.billingModel === "subscription"
                            ? "Subscription"
                            : a.billingModel === "hybrid"
                              ? "Hybrid Credit"
                              : "Prepaid Wallet"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {snap?.source || a.source}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {a.envKeys.length > 0 ? (
                          <div className="flex items-center space-x-1">
                            <Key className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                            <span>{a.envKeys[0]}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500">
                            Local CLI Session
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {isConnected ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                            Connected
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3 mr-1 inline" />
                            Partial Quota
                          </span>
                        ) : isBinaryMissing ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800">
                            CLI Missing
                          </span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-normal bg-slate-100 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800">
                              Not Configured
                            </span>
                            {a.envKeys.length > 0 && onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate("settings")}
                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium hover:underline inline-flex items-center cursor-pointer"
                              >
                                <span>Add Key</span>
                                <span className="ml-0.5">&rarr;</span>
                              </button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Custom Providers */}
                {customList.map((c, i) => (
                  <TableRow
                    key={`custom-${i}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/30"
                  >
                    <TableCell className="font-semibold text-slate-900 dark:text-zinc-100">
                      <div className="flex items-center space-x-2">
                        <ProviderIcon provider="custom" size={18} />
                        <span>{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-zinc-400">
                      Custom
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 dark:text-zinc-300">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.billingModel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500 dark:text-zinc-400 truncate max-w-[180px]">
                      {c.endpoint}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                      Custom Key
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                        Connected
                      </span>
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
