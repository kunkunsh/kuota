import * as React from "react";
import { Sun, Moon, Laptop } from "lucide-react";

export type ThemeMode = "dark" | "light" | "system";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "dark" | "light";
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "kuota-color-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === "dark" || stored === "light" || stored === "system") {
        return stored;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }
    return "dark";
  });

  const [systemIsDark, setSystemIsDark] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "dark" | "light" =
    theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    root.classList.remove("dark", "light");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    // Update dynamic favicon link if present
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = `./kuota-favicon-${resolvedTheme}.svg`;
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore localStorage write error
    }
  }, [theme, resolvedTheme]);

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for non-wrapped environments or unit tests
    return {
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Compact icon button to toggle between Light and Dark themes.
 */
export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      data-no-drag
      onClick={toggleTheme}
      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
        resolvedTheme === "dark"
          ? "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-800"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200/80"
      } ${className}`}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-indigo-600" />
      )}
    </button>
  );
}

/**
 * Three-state segmented selector (Light / Dark / System).
 */
export function ThemeSegmentedSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: "light", label: "Light", icon: Sun },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "system", label: "System", icon: Laptop },
  ];

  return (
    <div
      data-no-drag
      className={`inline-flex items-center rounded-lg p-0.5 border border-border bg-card/60 ${className}`}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            data-no-drag
            onClick={() => setTheme(opt.mode)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? "bg-zinc-800 text-zinc-100 dark:bg-zinc-700 dark:text-zinc-50 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
