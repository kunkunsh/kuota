import * as React from "react";

export type KuotaTheme = "dark" | "light" | "auto";

export interface KuotaLogoProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Theme variant.
   * - "dark": Ivory glyph (#F6F8F5) with mint quota arc (#36D7A2)
   * - "light": Graphite glyph (#1C2026) with mint quota arc (#36D7A2)
   * - "auto": Detects documentElement .dark / .light class or prefers-color-scheme (default: "auto")
   */
  theme?: KuotaTheme;
  /**
   * Whether to display the squircle container background.
   * Default is `false` for in-app clean unboxed glyph display.
   */
  withBackground?: boolean;
  /**
   * Whether to render the ideal pace tick marker.
   * Default is `true` for sizes >= 20px, `false` for tiny icons.
   */
  showTick?: boolean;
  /**
   * Render width and height in px (e.g. 20, 24, 32, 48).
   */
  size?: number | string;
}

/**
 * Official Kuota brand SVG vector mark.
 * Deterministic vector geometry supporting light and dark themes with optional squircle container.
 */
export function KuotaLogo({
  theme = "auto",
  withBackground = false,
  showTick,
  size = 24,
  className = "",
  style,
  ...props
}: KuotaLogoProps) {
  let resolvedTheme: "dark" | "light" = theme === "light" ? "light" : "dark";
  let setResolvedTheme: (t: "dark" | "light") => void = () => {};

  try {
    const [stateTheme, setStateTheme] = React.useState<"dark" | "light">(() => {
      if (theme === "dark" || theme === "light") return theme;
      if (typeof document !== "undefined") {
        if (document.documentElement.classList.contains("light")) return "light";
        if (document.documentElement.classList.contains("dark")) return "dark";
        if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
      }
      return "dark";
    });
    resolvedTheme = theme === "dark" || theme === "light" ? theme : stateTheme;
    setResolvedTheme = setStateTheme;

    React.useEffect(() => {
      if (theme === "dark" || theme === "light") {
        setResolvedTheme(theme);
        return;
      }

      if (typeof document === "undefined") return;

      const checkTheme = () => {
        if (document.documentElement.classList.contains("light")) {
          setResolvedTheme("light");
        } else if (document.documentElement.classList.contains("dark")) {
          setResolvedTheme("dark");
        } else {
          const mq = window.matchMedia("(prefers-color-scheme: light)");
          setResolvedTheme(mq.matches ? "light" : "dark");
        }
      };

      checkTheme();

      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const mqListener = () => checkTheme();
      mq.addEventListener("change", mqListener);

      return () => {
        observer.disconnect();
        mq.removeEventListener("change", mqListener);
      };
    }, [theme]);
  } catch {
    // Headless / direct unit test invocation without React dispatcher
    resolvedTheme = theme === "light" ? "light" : "dark";
  }

  const isDark = resolvedTheme === "dark";

  // Official brand tokens from Architecture & Brand specifications
  const glyphStroke = isDark ? "#F6F8F5" : "#1C2026";
  const arcStroke = "#36D7A2"; // Kuota Mint
  const tickStroke = glyphStroke;
  const bgFill = isDark ? "#15181D" : "#C3CAC6";

  // Small size check (< 20px defaults to hiding tick for maximum clarity)
  const numericSize = typeof size === "number" ? size : Number.parseInt(String(size), 10);
  const renderTick = showTick ?? (!Number.isNaN(numericSize) && numericSize >= 20);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={`Kuota logo (${resolvedTheme} theme)`}
      className={`select-none shrink-0 ${className}`}
      style={style}
      {...props}
    >
      {withBackground && (
        <rect
          width="128"
          height="128"
          rx="28"
          fill={bgFill}
          className="transition-colors duration-200"
        />
      )}
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors duration-200"
      >
        {/* K Stem */}
        <path d="M34 31V96" stroke={glyphStroke} strokeWidth="18" />
        {/* K Lower Diagonal */}
        <path d="M40 69L79 98" stroke={glyphStroke} strokeWidth="18" />
        {/* Kuota Arc */}
        <path d="M42 65C52 40 68 29 93 32" stroke={arcStroke} strokeWidth="18" />
        {/* Ideal Pace Tick */}
        {renderTick && <path d="M79.9 22.6L81.1 36.4" stroke={tickStroke} strokeWidth="4.5" />}
      </g>
    </svg>
  );
}

/**
 * Wordmark combining the Kuota logo icon with the platform typographic title.
 */
export function KuotaWordmark({
  theme = "auto",
  withBackground = false,
  size = 24,
  className = "",
}: {
  theme?: KuotaTheme;
  withBackground?: boolean;
  size?: number | string;
  className?: string;
}) {
  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <KuotaLogo theme={theme} withBackground={withBackground} size={size} />
      <span className="font-semibold text-sm tracking-tight text-foreground">Kuota</span>
    </div>
  );
}
