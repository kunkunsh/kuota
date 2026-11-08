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
  AppWindow,
  Bell,
  Sparkles,
  RefreshCw,
  Download,
} from "lucide-react";
import { ThemeSegmentedSelector, useTheme } from "../../lib/theme.js";
import { useI18n, LanguageSegmentedSelector } from "../../lib/i18n.js";
import { checkForUpdates, installUpdate, CURRENT_APP_VERSION, type UpdateResult } from "../../lib/updater.js";
import { KuotaLogo } from "../ui/kuota-logo.js";
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";

export function SettingsView() {
  const { resolvedTheme } = useTheme();
  const { t, lang } = useI18n();
  const [showKeys, setShowKeys] = React.useState<Record<string, boolean>>({});
  const [keyValues, setKeyValues] = React.useState<Record<string, string>>({});
  const [endpointValues, setEndpointValues] = React.useState<Record<string, string>>({});
  const [keychainSaved, setKeychainSaved] = React.useState<Record<string, boolean>>({});
  const [expandedGuide, setExpandedGuide] = React.useState<Record<string, boolean>>({});
  const [showMenuBar, setShowMenuBar] = React.useState<boolean>(true);
  const [menuBarMode, setMenuBarMode] = React.useState<string>("primary_percent");
  const [enableNotifications, setEnableNotifications] = React.useState<boolean>(true);
  const [notificationThreshold, setNotificationThreshold] = React.useState<number>(15);
  const [statusNotice, setStatusNotice] = React.useState<string | null>(null);

  const [updateStatus, setUpdateStatus] = React.useState<{
    checking: boolean;
    result: UpdateResult | null;
    installing: boolean;
    installMessage: string | null;
  }>({
    checking: false,
    result: null,
    installing: false,
    installMessage: null,
  });

  const handleManualCheckUpdates = async () => {
    setUpdateStatus((prev) => ({ ...prev, checking: true, installMessage: null }));
    try {
      const res = await checkForUpdates();
      setUpdateStatus((prev) => ({ ...prev, checking: false, result: res }));
    } catch (err) {
      setUpdateStatus((prev) => ({
        ...prev,
        checking: false,
        result: {
          currentVersion: CURRENT_APP_VERSION,
          available: false,
          error: String(err),
        },
      }));
    }
  };

  const handleInstallAppUpdate = async () => {
    setUpdateStatus((prev) => ({ ...prev, installing: true }));
    try {
      const res = await installUpdate();
      setUpdateStatus((prev) => ({
        ...prev,
        installing: false,
        installMessage: res.message || (res.success ? "Update installed" : "Failed"),
      }));
    } catch (err) {
      setUpdateStatus((prev) => ({
        ...prev,
        installing: false,
        installMessage: `Error: ${String(err)}`,
      }));
    }
  };

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

          try {
            const cfg = (await invoke("get_user_config")) as any;
            if (cfg && typeof cfg.showMenuBarIcon === "boolean") {
              setShowMenuBar(cfg.showMenuBarIcon);
            }
            if (cfg && typeof cfg.menuBarDisplayMode === "string") {
              setMenuBarMode(cfg.menuBarDisplayMode);
            }
            if (cfg && typeof cfg.enableNotifications === "boolean") {
              setEnableNotifications(cfg.enableNotifications);
            }
            if (cfg && typeof cfg.notificationThreshold === "number") {
              setNotificationThreshold(cfg.notificationThreshold);
            }
          } catch {}
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
            if (typeof data.showMenuBarIcon === "boolean") {
              setShowMenuBar(data.showMenuBarIcon);
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

  const handleToggleMenuBar = async (enabled: boolean) => {
    setShowMenuBar(enabled);
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_menu_bar_visible", { visible: enabled });
        const existing = ((await invoke("get_user_config")) as any) || {};
        await invoke("save_user_config", {
          config: { ...existing, showMenuBarIcon: enabled },
        });
        setStatusNotice(enabled ? "Menu bar icon visible in status bar" : "Menu bar icon hidden");
      } catch (err) {
        setStatusNotice(`Failed to update tray: ${String(err)}`);
      }
    } else {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showMenuBarIcon: enabled }),
        });
        setStatusNotice(enabled ? "Menu bar icon enabled" : "Menu bar icon disabled");
      } catch {}
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleSelectMenuBarMode = async (mode: string) => {
    setMenuBarMode(mode);
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const existing = ((await invoke("get_user_config")) as any) || {};
        await invoke("save_user_config", {
          config: { ...existing, menuBarDisplayMode: mode },
        });
        if ((window as any).__KUOTA_REFRESH) {
          (window as any).__KUOTA_REFRESH();
        }
        setStatusNotice("Status bar display mode updated");
      } catch {}
    } else {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menuBarDisplayMode: mode }),
        });
      } catch {}
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setEnableNotifications(enabled);
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const existing = ((await invoke("get_user_config")) as any) || {};
        await invoke("save_user_config", {
          config: { ...existing, enableNotifications: enabled },
        });
        setStatusNotice(enabled ? "Native desktop notifications enabled" : "Notifications disabled");
      } catch {}
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleChangeThreshold = async (val: number) => {
    setNotificationThreshold(val);
    if (isDesktop) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const existing = ((await invoke("get_user_config")) as any) || {};
        await invoke("save_user_config", {
          config: { ...existing, notificationThreshold: val },
        });
        setStatusNotice(`Warning alert threshold set to ${val}%`);
      } catch {}
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const apiProviders = PROVIDER_CATALOG.filter((p) => p.envKeys.length > 0);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          Settings &amp; Configuration
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          OS Keychain credentials, appearance themes, local scheduler parameters, and retention policies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Appearance & Brand Identity Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-900 dark:text-zinc-100">
              <Palette className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Appearance &amp; Brand Theme</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-400">
              Toggle between Dark, Light, and System appearances with adaptive vector mark rendering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">{t("theme.appearance")}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Select color theme for web dashboard, desktop chrome, and vector icons
                </div>
              </div>
              <ThemeSegmentedSelector />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">{t("lang.language")}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Switch between English and 简体中文 interface translations
                </div>
              </div>
              <LanguageSegmentedSelector />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-100/60 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800/80">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex items-center justify-center shadow-2xs">
                      <KuotaLogo size={32} withBackground={false} theme={resolvedTheme} />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Unboxed Glyph</span>
                  </div>

                  <div className="flex flex-col items-center space-y-1">
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex items-center justify-center shadow-2xs">
                      <KuotaLogo size={32} withBackground={true} theme={resolvedTheme} />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500">Squircle Icon</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-0.5">
                  <div className="font-medium text-xs text-slate-800 dark:text-zinc-200">
                    Kuota Vector System A ({resolvedTheme} mode)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Mint arc (<code className="text-[10px] text-emerald-600 dark:text-emerald-400">#36D7A2</code>),{" "}
                    {resolvedTheme === "dark" ? "ivory" : "graphite"} glyph (
                    <code className="text-[10px] text-slate-700 dark:text-zinc-300">
                      {resolvedTheme === "dark" ? "#F6F8F5" : "#1C2026"}
                    </code>
                    ), deterministic SVG.
                  </div>
                </div>
              </div>

              <Badge variant="outline" className="text-[10px] self-start sm:self-center text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">
                SVG Master
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Software Updates Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>{t("update.software_updates")}</span>
            </CardTitle>
            <CardDescription>{t("update.software_updates_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  {t("update.current_version")}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  v{CURRENT_APP_VERSION} · Channel: Stable Releases
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={updateStatus.checking || updateStatus.installing}
                  onClick={handleManualCheckUpdates}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", updateStatus.checking && "animate-spin")} />
                  <span>
                    {updateStatus.checking ? t("update.checking") : t("update.check")}
                  </span>
                </button>
              </div>
            </div>

            {/* Check Results Notice */}
            {updateStatus.result && (
              <div
                className={cn(
                  "p-3 rounded-xl border flex flex-col space-y-2",
                  updateStatus.result.available
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-100"
                    : updateStatus.result.error
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {updateStatus.result.available ? (
                      <Sparkles className="w-4 h-4 text-blue-500" />
                    ) : updateStatus.result.error ? (
                      <CheckCircle2 className="w-4 h-4 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="font-semibold text-xs">
                      {updateStatus.result.available
                        ? `${t("update.available")}: v${updateStatus.result.targetVersion}`
                        : updateStatus.result.error
                          ? `${t("update.failed")}: ${updateStatus.result.error}`
                          : t("update.already_latest")}
                    </span>
                  </div>

                  {updateStatus.result.available && (
                    <button
                      type="button"
                      disabled={updateStatus.installing}
                      onClick={handleInstallAppUpdate}
                      className="flex items-center space-x-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {updateStatus.installing ? t("update.installing") : t("update.install")}
                      </span>
                    </button>
                  )}
                </div>

                {updateStatus.result.body && (
                  <div className="text-[11px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto pl-6 font-mono">
                    {updateStatus.result.body}
                  </div>
                )}
                {updateStatus.installMessage && (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pl-6">
                    {updateStatus.installMessage}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* macOS Menu Bar App & Popover Configuration */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <AppWindow className="w-4 h-4 text-emerald-400" />
              <span>Menu Bar App &amp; Transient Popover</span>
            </CardTitle>
            <CardDescription>
              Toggle the status bar icon and configure the transient HUD popover behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div className="space-y-0.5 pr-4">
                <div className="font-medium text-slate-800 dark:text-zinc-200">Show Menu Bar Icon</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Display Kuota in the macOS menu bar with live quota stats. Click to toggle HUD popover.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleMenuBar(!showMenuBar)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showMenuBar ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    showMenuBar ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div className="space-y-0.5">
                <div className="font-medium text-slate-800 dark:text-zinc-200">Auto-Dismiss on Blur (Focus Loss)</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Like native system monitors (Stats, iStat Menus), the popover closes immediately when clicking outside.
                </div>
              </div>
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                Active
              </Badge>
            </div>

            {/* Menu Bar Status Display Mode */}
            <div className="py-2 border-b border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="space-y-0.5">
                <div className="font-medium text-slate-800 dark:text-zinc-200">Status Bar Display Format</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Choose what telemetry appears directly next to the menu bar icon in the macOS status bar
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: "primary_percent", label: "Primary %", preview: "55%" },
                  { id: "lowest_quota", label: "Lowest Quota", preview: "⚠️ 8%" },
                  { id: "wallet_spend", label: "Spend / Balance", preview: "$24.07" },
                  { id: "provider_label", label: "Provider + %", preview: "Claude 55%" },
                  { id: "icon_only", label: "Icon Only", preview: "—" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelectMenuBarMode(mode.id)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      menuBarMode === mode.id
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-800 dark:text-white"
                        : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200">{mode.label}</span>
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{mode.preview}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* macOS Native Notifications */}
            <div className="py-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <div className="font-medium text-slate-800 dark:text-zinc-200 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Low Quota Sound Alerts</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Send native macOS banner notifications with sound when remaining quota drops below threshold or resets.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleNotifications(!enableNotifications)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableNotifications ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      enableNotifications ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {enableNotifications && (
                <div className="flex items-center space-x-2 pt-1 pl-1">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">Warning Threshold:</span>
                  {[10, 15, 20, 25].map((thresh) => (
                    <button
                      key={thresh}
                      type="button"
                      onClick={() => handleChangeThreshold(thresh)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                        notificationThreshold === thresh
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40"
                          : "bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      &le; {thresh}%
                    </button>
                  ))}
                </div>
              )}
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
                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all space-y-2.5"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs shrink-0">
                          <ProviderIcon provider={p.id} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate">{p.name}</span>
                            {isSaved && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.2 shrink-0">
                                Protected
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-500">{envName}</span>
                        </div>
                      </div>

                      {/* Guide button */}
                      <button
                        type="button"
                        onClick={() => toggleGuide(p.id)}
                        className="flex items-center space-x-1 text-[11px] text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                        <span>Where to get</span>
                      </button>
                    </div>

                    {/* Step-by-Step Guide Box (Cherry Studio style) */}
                    {isGuideOpen && (
                      <div className="p-2.5 rounded-lg bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20 dark:border-indigo-900/40 text-[11px] space-y-2 animate-in fade-in duration-200">
                        <div className="text-slate-700 dark:text-zinc-300 leading-relaxed font-normal">
                          {p.howToGet || `Visit ${p.name} developer portal to create an API key.`}
                        </div>
                        {p.consoleUrl && (
                          <button
                            type="button"
                            onClick={() => openConsoleUrl(p.consoleUrl)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-200 border border-indigo-500/30 font-medium transition-colors text-[10px] cursor-pointer"
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
                        className="w-full pl-2.5 pr-16 py-1.5 text-xs bg-white dark:bg-zinc-900/90 border border-slate-300 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600 transition-colors"
                      />
                      <div className="absolute right-1.5 flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => toggleShowKey(p.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
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
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 capitalize">
                        {p.billingModel === "subscription" ? "Quota Subscription" : "Prepaid Wallet"}
                      </span>

                      <div className="flex items-center space-x-2">
                        {isSaved && (
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(p.id)}
                            className="flex items-center space-x-1 px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 text-[10px] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveKey(p.id)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 text-[10px] font-medium transition-colors cursor-pointer"
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
            <div className="flex items-center space-x-2.5 text-[11px] text-slate-600 dark:text-zinc-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 mt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong className="text-slate-800 dark:text-zinc-200">Zero Plaintext Guarantee:</strong> Entered API keys are stored via{" "}
                <code className="text-emerald-700 dark:text-emerald-300 font-mono">tauri-plugin-keyring</code> in your native OS
                Keychain (Apple Keychain on macOS, Windows Credential Manager on Windows). They are never saved
                in plaintext files or synced to the cloud.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sampling Cadence Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-900 dark:text-zinc-100">
              <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Sampling Cadence</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-400">Frequency of automated background quota checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">Adaptive Sampling</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  15 min while active coding, 60 min background
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              >
                Active
              </Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">Sleeping Device Mode</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Skip checks on lid close; no catch-up synthetic events
                </div>
              </div>
              <Badge variant="outline" className="text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">429 Rate Limit Cooldown</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Enforce strict 15-minute wait before retry
                </div>
              </div>
              <Badge variant="outline" className="text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">Enforced</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Local Storage & Retention Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-900 dark:text-zinc-100">
              <HardDrive className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <span>Local Storage &amp; Retention</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-400">Disk space policy for historical JSONL events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-slate-600 dark:text-zinc-300">Retention Horizon</span>
              <span className="font-medium text-slate-900 dark:text-zinc-100">400 days (local JSONL)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-slate-600 dark:text-zinc-300">Partition Strategy</span>
              <span className="font-medium text-slate-900 dark:text-zinc-100">UTC Day (events-YYYY-MM-DD.jsonl)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600 dark:text-zinc-300">Max Partition File Size</span>
              <span className="font-medium text-slate-900 dark:text-zinc-100">16 MiB with auto-rotation</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
