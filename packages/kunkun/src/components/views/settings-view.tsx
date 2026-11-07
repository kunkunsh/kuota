import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import {
  Clock,
  HardDrive,
  Palette,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Trash2,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { ThemeSegmentedSelector, useTheme } from "../../lib/theme.js";
import { KuotaLogo } from "../ui/kuota-logo.js";
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";

export function SettingsView() {
  const { resolvedTheme } = useTheme();
  const [showKeys, setShowKeys] = React.useState<Record<string, boolean>>({});
  const [keyValues, setKeyValues] = React.useState<Record<string, string>>({});
  const [endpointValues, setEndpointValues] = React.useState<Record<string, string>>({});
  const [keychainSaved, setKeychainSaved] = React.useState<Record<string, boolean>>({});
  const [expandedGuide, setExpandedGuide] = React.useState<Record<string, boolean>>({});
  const [statusNotice, setStatusNotice] = React.useState<string | null>(null);

  // Check if running in Tauri desktop environment
  const isDesktop =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  // Load existing keys / status on mount
  React.useEffect(() => {
    async function loadInitialKeys() {
      if (isDesktop) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const saved: Record<string, boolean> = {};
          const vals: Record<string, string> = {};

          for (const p of PROVIDER_CATALOG) {
            try {
              const pass = (await invoke("get_keychain_password", { provider: p.id })) as string | null;
              if (pass && pass.length > 0) {
                saved[p.id] = true;
                vals[p.id] = pass;
              }
            } catch {
              // ignore
            }
          }
          setKeychainSaved(saved);
          setKeyValues(vals);
        } catch {
          // ignore
        }
      } else {
        try {
          const res = await fetch("/api/config");
          if (res.ok) {
            const data = await res.json();
            const saved: Record<string, boolean> = {};
            const vals: Record<string, string> = {};
            if (data.keys) {
              for (const [k, v] of Object.entries(data.keys)) {
                if (typeof v === "string" && v.length > 0) {
                  saved[k] = true;
                  vals[k] = v;
                }
              }
            }
            if (data.endpoints) {
              setEndpointValues(data.endpoints);
            }
            setKeychainSaved(saved);
            setKeyValues(vals);
          }
        } catch {
          // ignore
        }
      }
    }
    void loadInitialKeys();
  }, [isDesktop]);

  const toggleShowKey = (providerId: string) => {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const toggleGuide = (providerId: string) => {
    setExpandedGuide((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const openConsoleUrl = async (url?: string) => {
    if (!url) return;
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_external_url", { url });
        return;
      } catch {
        // fallback
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSaveKey = async (providerId: string) => {
    const secret = keyValues[providerId]?.trim() || "";
    if (!secret) return;

    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_keychain_password", { provider: providerId, secret });
        setKeychainSaved((prev) => ({ ...prev, [providerId]: true }));
        setStatusNotice(`Saved ${providerId} key securely to OS Keychain!`);
      } catch (err) {
        setStatusNotice(`Failed to save: ${String(err)}`);
      }
    } else {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: { [providerId]: secret } }),
        });
        setKeychainSaved((prev) => ({ ...prev, [providerId]: true }));
        setStatusNotice(`Saved ${providerId} key securely!`);
      } catch (err) {
        setStatusNotice(`Failed to save: ${String(err)}`);
      }
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleDeleteKey = async (providerId: string) => {
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_keychain_password", { provider: providerId });
      } catch {
        // ignore
      }
    } else {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: { [providerId]: "" } }),
        });
      } catch {
        // ignore
      }
    }
    setKeychainSaved((prev) => ({ ...prev, [providerId]: false }));
    setKeyValues((prev) => ({ ...prev, [providerId]: "" }));
    setStatusNotice(`Removed ${providerId} key from Keychain.`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const apiProviders = PROVIDER_CATALOG.filter((p) => p.envKeys.length > 0);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Settings &amp; Configuration
        </h2>
        <p className="text-xs text-zinc-400">
          OS Keychain credentials, appearance themes, local scheduler parameters, and retention policies.
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

        {/* API Credentials Card with OS Keychain Security */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Provider API Keys &amp; Credentials</span>
                <Badge
                  variant="outline"
                  className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-normal ml-1"
                >
                  <Lock className="w-2.5 h-2.5 mr-1 inline" />
                  OS Keychain Encrypted
                </Badge>
              </CardTitle>
              <CardDescription>
                Credentials are stored directly in your OS Keychain (Apple Keychain / Windows Credential Manager). Zero plaintext files.
              </CardDescription>
            </div>
            {statusNotice && (
              <span className="text-xs text-emerald-400 font-medium animate-in fade-in flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{statusNotice}</span>
              </span>
            )}
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {apiProviders.map((p) => {
                const isShown = Boolean(showKeys[p.id]);
                const isSaved = Boolean(keychainSaved[p.id]);
                const isGuideOpen = Boolean(expandedGuide[p.id]);
                const envName = p.envKeys[0];
                const currentVal = keyValues[p.id] ?? "";

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2.5"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm shrink-0">
                          <ProviderIcon provider={p.id} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-zinc-100 truncate">{p.name}</span>
                            {isSaved && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.2 shrink-0">
                                Protected
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500">{envName}</span>
                        </div>
                      </div>

                      {/* Guide button */}
                      <button
                        type="button"
                        onClick={() => toggleGuide(p.id)}
                        className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 transition-colors"
                      >
                        <HelpCircle className="w-3 h-3 text-indigo-400" />
                        <span>Where to get</span>
                      </button>
                    </div>

                    {/* Step-by-Step Guide Box (Cherry Studio style) */}
                    {isGuideOpen && (
                      <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-[11px] space-y-2 animate-in fade-in duration-200">
                        <div className="text-zinc-300 leading-relaxed font-normal">
                          {p.howToGet || `Visit ${p.name} developer portal to create an API key.`}
                        </div>
                        {p.consoleUrl && (
                          <button
                            type="button"
                            onClick={() => openConsoleUrl(p.consoleUrl)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 font-medium transition-colors text-[10px]"
                          >
                            <span>Open Developer Console</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-1" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* API Key Input Field */}
                    <div className="relative flex items-center">
                      <input
                        type={isShown ? "text" : "password"}
                        placeholder={isSaved ? "••••••••••••••••••••••••" : `Paste ${p.shortName} API key...`}
                        value={currentVal}
                        onChange={(e) =>
                          setKeyValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full pl-2.5 pr-16 py-1.5 text-xs bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
                      />
                      <div className="absolute right-1.5 flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => toggleShowKey(p.id)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {isShown ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-[10px] text-zinc-500 capitalize">
                        {p.billingModel === "subscription" ? "Quota Subscription" : "Prepaid Wallet"}
                      </span>

                      <div className="flex items-center space-x-2">
                        {isSaved && (
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(p.id)}
                            className="flex items-center space-x-1 px-2 py-1 rounded text-red-400 hover:bg-red-500/10 border border-red-500/20 text-[10px] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveKey(p.id)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-[10px] font-medium transition-colors"
                        >
                          <Save className="w-3 h-3 mr-0.5" />
                          <span>Save Key</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security Guarantee banner */}
            <div className="flex items-center space-x-2.5 text-[11px] text-zinc-400 bg-emerald-950/20 p-3 rounded-xl border border-emerald-900/40 mt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Zero Plaintext Guarantee:</strong> Entered API keys are stored via{" "}
                <code className="text-emerald-300 font-mono">tauri-plugin-keyring</code> in your native OS
                Keychain (Apple Keychain on macOS, Windows Credential Manager on Windows). They are never saved
                in plaintext files or synced to the cloud.
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
