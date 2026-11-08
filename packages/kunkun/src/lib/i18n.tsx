import * as React from "react";
import { Globe } from "lucide-react";
import { cn } from "./utils.js";

export type Language = "en" | "zh";

export interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const STORAGE_KEY = "kuota-language";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Views
    "nav.overview": "Overview",
    "nav.history": "History & Forecast",
    "nav.detail": "Provider Detail",
    "nav.connections": "Connections",
    "nav.usage": "Usage",
    "nav.projects": "Projects",
    "nav.benchmarks": "Benchmarks",
    "nav.data": "Data Sync",
    "nav.alerts": "Alerts",
    "nav.settings": "Settings",
    "nav.refresh": "Refresh",
    "nav.quit": "Quit",

    // Header & Popover
    "header.hud": "HUD",
    "header.search_placeholder": "Search providers, models, tokens...",
    "header.about": "About Kuota",
    "header.foreground": "Foreground",
    "header.mapped_to": "Mapped to",
    "header.now": "Now",
    "header.today": "Today",
    "header.all_providers": "All Providers",

    // Tray Display Modes
    "tray.display_mode": "Menu Bar",
    "tray.icon_only": "Icon",
    "tray.active_app": "Active App",
    "tray.lowest_quota": "Lowest %",
    "tray.primary_percent": "Primary %",

    // Pacing & Quota status
    "pacing.on_pace": "On pace",
    "pacing.overspent": "Overspent",
    "pacing.burning_fast": "Burning fast",
    "pacing.in_reserve": "in reserve",
    "pacing.behind_target": "behind target pace",
    "pacing.ahead_target": "ahead of ideal pace",
    "pacing.resets_in": "Resets in",
    "pacing.left": "left",
    "pacing.used": "Used",
    "pacing.spending": "Spending",
    "pacing.no_session": "No session running",
    "pacing.api_value": "API value",
    "pacing.tokens": "tokens",
    "pacing.from_cache": "from cache",
    "pacing.weekly": "Week",
    "pacing.five_hour": "5-Hour Session Window",
    "pacing.weekly_quota": "Weekly Quota",
    "pacing.monthly_quota": "Monthly Quota",

    // Updates
    "update.check": "Check for Updates",
    "update.checking": "Checking...",
    "update.up_to_date": "Up to date",
    "update.available": "Update Available",
    "update.install": "Install & Restart",
    "update.installing": "Installing...",
    "update.failed": "Check failed",
    "update.current_version": "Current Version",
    "update.latest_version": "Latest Version",
    "update.release_notes": "Release Notes",
    "update.software_updates": "Software Updates",
    "update.software_updates_desc": "Check for new releases and install updates directly",
    "update.already_latest": "You are running the latest version of Kuota",

    // Theme & Language
    "theme.appearance": "Appearance",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "theme.system": "System",
    "lang.language": "Language",
    "lang.select": "Language",
    "lang.en": "English",
    "lang.zh": "简体中文",

    // Settings View
    "settings.title": "Settings & Preferences",
    "settings.description":
      "Configure API credentials, appearance, update checks, and notification thresholds",
    "settings.general": "General",
    "settings.menubar": "Menu Bar Icon & Display",
    "settings.menubar_desc": "Customize status bar icon and live telemetry mode",
    "settings.show_menubar": "Show Menu Bar Icon",
    "settings.display_mode": "Live Display Mode",
    "settings.notifications": "Quota Push Notifications",
    "settings.notifications_desc": "Native macOS/Windows alerts when limits approach",
    "settings.notify_threshold": "Low Quota Alert Threshold",
    "settings.providers_keys": "API Providers & Keys",
    "settings.providers_desc": "Stored securely in your native OS Keychain",
    "settings.sampling_cadence": "Sampling Cadence",
    "settings.sampling_desc": "Frequency of automated background quota checks",
    "settings.storage": "Local Storage & Retention",
    "settings.storage_desc": "Disk space policy for historical JSONL events",
    "settings.save_key": "Save Key",
    "settings.remove": "Remove",
    "settings.secured_keychain": "Secured in Keychain",
    "settings.enter_key": "Enter API key or session token...",
    "settings.active": "Active",
    "settings.enabled": "Enabled",
    "settings.enforced": "Enforced",
  },
  zh: {
    // Navigation & Views
    "nav.overview": "全览概览",
    "nav.history": "历史与预测",
    "nav.detail": "服务商详情",
    "nav.connections": "连接状态",
    "nav.usage": "消耗分析",
    "nav.projects": "项目归属",
    "nav.benchmarks": "效能基准",
    "nav.data": "数据同步",
    "nav.alerts": "告警规则",
    "nav.settings": "系统设置",
    "nav.refresh": "刷新",
    "nav.quit": "退出",

    // Header & Popover
    "header.hud": "HUD 浮窗",
    "header.search_placeholder": "搜索服务商、模型、代币...",
    "header.about": "关于 Kuota",
    "header.foreground": "前台活跃",
    "header.mapped_to": "映射至",
    "header.now": "当前会话",
    "header.today": "今日概况",
    "header.all_providers": "全部服务商",

    // Tray Display Modes
    "tray.display_mode": "菜单栏显示",
    "tray.icon_only": "纯图标",
    "tray.active_app": "前台应用",
    "tray.lowest_quota": "最低配额 %",
    "tray.primary_percent": "主配额 %",

    // Pacing & Quota status
    "pacing.on_pace": "节奏良好",
    "pacing.overspent": "消耗过快",
    "pacing.burning_fast": "快速消耗中",
    "pacing.in_reserve": "储备充裕",
    "pacing.behind_target": "落后目标节奏",
    "pacing.ahead_target": "领先目标节奏",
    "pacing.resets_in": "重置倒计时",
    "pacing.left": "剩余",
    "pacing.used": "已用",
    "pacing.spending": "实时开销",
    "pacing.no_session": "当前无活跃会话",
    "pacing.api_value": "API 对应价值",
    "pacing.tokens": "Tokens",
    "pacing.from_cache": "命中缓存",
    "pacing.weekly": "周配额",
    "pacing.five_hour": "5小时会话窗口",
    "pacing.weekly_quota": "每周配额",
    "pacing.monthly_quota": "每月配额",

    // Updates
    "update.check": "检查更新",
    "update.checking": "检查中...",
    "update.up_to_date": "已是最新版本",
    "update.available": "发现新版本",
    "update.install": "下载并重启",
    "update.installing": "正在更新...",
    "update.failed": "检查失败",
    "update.current_version": "当前版本",
    "update.latest_version": "最新版本",
    "update.release_notes": "更新日志",
    "update.software_updates": "软件更新",
    "update.software_updates_desc": "检查 GitHub Releases 最新版本并一键安装更新",
    "update.already_latest": "您正在使用最新版 Kuota",

    // Theme & Language
    "theme.appearance": "外观主题",
    "theme.dark": "深色",
    "theme.light": "浅色",
    "theme.system": "跟随系统",
    "lang.language": "界面语言",
    "lang.select": "语言",
    "lang.en": "English",
    "lang.zh": "简体中文",

    // Settings View
    "settings.title": "设置与偏好",
    "settings.description": "配置 API 凭据、外观主题、软件更新以及系统通知阈值",
    "settings.general": "常规",
    "settings.menubar": "菜单栏图标与显示",
    "settings.menubar_desc": "自定义 macOS 状态栏图标与实时遥测指标展示模式",
    "settings.show_menubar": "显示菜单栏图标",
    "settings.display_mode": "实时显示模式",
    "settings.notifications": "配额系统级推送通知",
    "settings.notifications_desc": "配额不足或重置恢复时弹出系统桌面原生提醒",
    "settings.notify_threshold": "低配额告警阈值",
    "settings.providers_keys": "服务商 API 密钥",
    "settings.providers_desc": "密钥加密存放在本地系统原生 Keychain / 凭据管理器中",
    "settings.sampling_cadence": "采集与巡检频率",
    "settings.sampling_desc": "后台自动化配额采集策略",
    "settings.storage": "本地存储与保留",
    "settings.storage_desc": "本地 JSONL 历史日志保留策略与磁盘分区限制",
    "settings.save_key": "保存密钥",
    "settings.remove": "移除",
    "settings.secured_keychain": "已安全存入钥匙串",
    "settings.enter_key": "输入 API Key 或 Session Token...",
    "settings.active": "运行中",
    "settings.enabled": "已开启",
    "settings.enforced": "强制执行",
  },
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "en" || stored === "zh") {
        return stored;
      }
      if (navigator.language?.toLowerCase().startsWith("zh")) {
        return "zh";
      }
    } catch {
      // ignore storage access errors
    }
    return "en";
  });

  const setLang = React.useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = React.useCallback(() => {
    setLang(lang === "en" ? "zh" : "en");
  }, [lang, setLang]);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = React.useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations[lang] || translations.en;
      if (dict[key] !== undefined) {
        return dict[key];
      }
      const enDict = translations.en;
      if (enDict[key] !== undefined) {
        return enDict[key];
      }
      return fallback !== undefined ? fallback : key;
    },
    [lang],
  );

  const value = React.useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t,
    }),
    [lang, setLang, toggleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  try {
    const ctx = React.useContext(I18nContext);
    if (ctx) {
      return ctx;
    }
  } catch {
    // Graceful fallback if called outside React rendering context
  }
  return {
    lang: "en",
    setLang: () => {},
    toggleLang: () => {},
    t: (key: string, fallback?: string) => fallback ?? key,
  };
}

/**
 * Compact language toggle button for headers and footers
 */
export function LanguageToggleButton({ className }: { className?: string }) {
  const { lang, toggleLang, t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLang}
      title={lang === "en" ? "切换为简体中文" : "Switch to English"}
      aria-label="Toggle language"
      className={cn(
        "inline-flex items-center space-x-1 px-1.5 py-1 rounded-md text-xs font-medium transition-colors border",
        "bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700",
        "text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/60 shadow-xs",
        className,
      )}
    >
      <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
      <span className="text-[11px] font-semibold">{lang === "en" ? "中" : "EN"}</span>
    </button>
  );
}

/**
 * Segmented Selector for Settings View
 */
export function LanguageSegmentedSelector({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg p-0.5 border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 text-xs",
        className,
      )}
      role="radiogroup"
      aria-label="Select language"
    >
      <button
        type="button"
        role="radio"
        aria-checked={lang === "en"}
        onClick={() => setLang("en")}
        className={cn(
          "px-3 py-1 rounded-md text-xs font-medium transition-all duration-150",
          lang === "en"
            ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
            : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200",
        )}
      >
        English
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={lang === "zh"}
        onClick={() => setLang("zh")}
        className={cn(
          "px-3 py-1 rounded-md text-xs font-medium transition-all duration-150",
          lang === "zh"
            ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
            : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200",
        )}
      >
        简体中文
      </button>
    </div>
  );
}
