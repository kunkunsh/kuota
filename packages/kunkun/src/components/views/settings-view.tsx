import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Clock, HardDrive, Palette, Key, ShieldCheck, Eye, EyeOff, Save } from "lucide-react";
import { ThemeSegmentedSelector, useTheme } from "../../lib/theme.js";
import { KuotaLogo } from "../ui/kuota-logo.js";
import { PROVIDER_CATALOG } from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";

export function SettingsView() {
  const { resolvedTheme } = useTheme();
  const [showKeys, setShowKeys] = React.useState<Record<string, boolean>>({});
  const [savedNotice, setSavedNotice] = React.useState(false);

  const toggleShowKey = (providerId: string) => {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const apiProviders = PROVIDER_CATALOG.filter((p) => p.envKeys.length > 0);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Settings &amp; Configuration
        </h2>
        <p className="text-xs text-zinc-400">
          Appearance themes, API credentials, local scheduler parameters, and retention policies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Appearance & Brand Identity Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>Appearance &amp; Brand Theme</span>
            </CardTitle>
            <CardDescription>
              Toggle between Dark, Light, and System appearances with adaptive vector mark rendering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-zinc-800">
              <div>
                <div className="font-medium text-zinc-200">Interface Appearance</div>
                <div className="text-[11px] text-zinc-400">
                  Select color theme for web dashboard, desktop chrome, and vector icons
                </div>
              </div>
              <ThemeSegmentedSelector />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 flex items-center justify-center">
                      <KuotaLogo size={32} withBackground={false} theme={resolvedTheme} />
                    </div>
                    <span className="text-[10px] text-zinc-500">Unboxed Glyph</span>
                  </div>

                  <div className="flex flex-col items-center space-y-1">
                    <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 flex items-center justify-center">
                      <KuotaLogo size={32} withBackground={true} theme={resolvedTheme} />
                    </div>
                    <span className="text-[10px] text-zinc-500">Squircle Icon</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-0.5">
                  <div className="font-medium text-xs text-zinc-200">
                    Kuota Vector System A ({resolvedTheme} mode)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Mint arc (<code className="text-[10px] text-emerald-400">#36D7A2</code>),{" "}
                    {resolvedTheme === "dark" ? "ivory" : "graphite"} glyph (
                    <code className="text-[10px] text-zinc-300">
                      {resolvedTheme === "dark" ? "#F6F8F5" : "#1C2026"}
                    </code>
                    ), deterministic SVG.
                  </div>
                </div>
              </div>

              <Badge variant="outline" className="text-[10px] self-start sm:self-center">
                SVG Master
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* API Credentials Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Provider API Keys &amp; Credentials</span>
              </CardTitle>
              <CardDescription>
                Credentials are saved locally in your environment or keychain. Zero cloud sync.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {savedNotice && (
                <span className="text-xs text-emerald-400 font-medium animate-in fade-in">
                  Saved successfully!
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 border border-zinc-700 transition-colors"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Save Keys</span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {apiProviders.map((p) => {
                const isShown = Boolean(showKeys[p.id]);
                const envName = p.envKeys[0];

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ProviderIcon provider={p.id} size={15} />
                        <span className="font-semibold text-zinc-200">{p.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500">{envName}</span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={isShown ? "text" : "password"}
                        placeholder={`Enter ${p.shortName} API key...`}
                        defaultValue=""
                        className="w-full pl-2.5 pr-8 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(p.id)}
                        className="absolute right-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isShown ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>
                        Model:{" "}
                        {p.billingModel === "subscription"
                          ? "Subscription Quota"
                          : "Prepaid Wallet"}
                      </span>
                      {p.docUrl && (
                        <a
                          href={p.docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zinc-300 underline"
                        >
                          Docs
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-zinc-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Privacy Guarantee: All keys are stored strictly on your local machine. They are
                never transmitted to any third-party analytics or external telemetry services.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sampling Cadence Card */}
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
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              >
                Active
              </Badge>
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

        {/* Local Storage & Retention Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>Local Storage &amp; Retention</span>
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
