import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export interface LoaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  title?: string;
  /** Pass an empty string to show the title alone. */
  subtitle?: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "default" | "emerald";
}

const SIZE_CONFIG = {
  xs: {
    container: "size-5",
    titleClass: "text-xs font-medium",
    subtitleClass: "text-[10px]",
    spacing: "space-y-1",
    maxWidth: "max-w-36",
  },
  sm: {
    container: "size-16",
    titleClass: "text-sm font-medium",
    subtitleClass: "text-xs",
    spacing: "space-y-1.5",
    maxWidth: "max-w-48",
  },
  md: {
    container: "size-28",
    titleClass: "text-base font-semibold",
    subtitleClass: "text-xs",
    spacing: "space-y-2",
    maxWidth: "max-w-64",
  },
  lg: {
    container: "size-40",
    titleClass: "text-lg font-semibold",
    subtitleClass: "text-sm",
    spacing: "space-y-3",
    maxWidth: "max-w-72",
  },
} as const;

const ringMask = (stops: string) => `radial-gradient(circle at 50% 50%, ${stops})`;

// Rings are tinted with `currentColor`, so one set covers light and dark mode
// and the loader can be recoloured with any `text-*` class.
const RINGS: { id: string; style: CSSProperties }[] = [
  {
    id: "outer",
    style: {
      background:
        "conic-gradient(from 0deg, transparent 0deg, currentColor 90deg, transparent 180deg)",
      mask: ringMask("transparent 35%, black 37%, black 39%, transparent 41%"),
      WebkitMask: ringMask("transparent 35%, black 37%, black 39%, transparent 41%"),
      opacity: 0.85,
      animationDuration: "3s",
    },
  },
  {
    id: "primary",
    style: {
      background:
        "conic-gradient(from 0deg, transparent 0deg, currentColor 120deg, color-mix(in srgb, currentColor 50%, transparent) 240deg, transparent 360deg)",
      mask: ringMask("transparent 42%, black 44%, black 48%, transparent 50%"),
      WebkitMask: ringMask("transparent 42%, black 44%, black 48%, transparent 50%"),
      opacity: 0.95,
      animationDuration: "1.2s",
    },
  },
  {
    id: "counter",
    style: {
      background:
        "conic-gradient(from 180deg, transparent 0deg, color-mix(in srgb, currentColor 60%, transparent) 45deg, transparent 90deg)",
      mask: ringMask("transparent 52%, black 54%, black 56%, transparent 58%"),
      WebkitMask: ringMask("transparent 52%, black 54%, black 56%, transparent 58%"),
      opacity: 0.4,
      animationDuration: "4s",
      animationDirection: "reverse",
    },
  },
  {
    id: "accent",
    style: {
      background:
        "conic-gradient(from 270deg, transparent 0deg, color-mix(in srgb, currentColor 40%, transparent) 20deg, transparent 40deg)",
      mask: ringMask("transparent 61%, black 62%, black 63%, transparent 64%"),
      WebkitMask: ringMask("transparent 61%, black 62%, black 63%, transparent 64%"),
      opacity: 0.55,
      animationDuration: "3.5s",
    },
  },
];

export function Loader({
  title = "Sampling AI quota telemetry...",
  subtitle = "Querying local Antigravity, Claude, and Codex adapters",
  size = "md",
  variant = "default",
  className,
  ...props
}: LoaderProps) {
  const config = SIZE_CONFIG[size];
  const isMicro = size === "xs";

  const colorClass = variant === "emerald" ? "text-emerald-400" : "text-zinc-100 dark:text-white";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center select-none",
        isMicro ? "gap-0 p-0" : "gap-5 p-6",
        className,
      )}
      {...props}
    >
      <div aria-hidden="true" className={cn("relative shrink-0", colorClass, config.container)}>
        {RINGS.map((ring) => (
          <div
            className="absolute inset-0 rounded-full motion-safe:animate-spin motion-reduce:animate-pulse"
            key={ring.id}
            style={ring.style}
          />
        ))}
      </div>

      {!isMicro && (title || subtitle) && (
        <output
          aria-live="polite"
          className={cn(
            "block text-center transition-opacity duration-200 ease-out",
            config.spacing,
            config.maxWidth,
          )}
        >
          {title && (
            <span
              className={cn(
                config.titleClass,
                "block text-zinc-100 font-medium leading-[1.2] tracking-tight antialiased dark:text-white/95",
              )}
            >
              {title}
            </span>
          )}
          {subtitle && (
            <span
              className={cn(
                config.subtitleClass,
                "block font-normal text-zinc-400 leading-[1.4] tracking-normal antialiased dark:text-zinc-400",
              )}
            >
              {subtitle}
            </span>
          )}
        </output>
      )}
    </div>
  );
}

export default Loader;
