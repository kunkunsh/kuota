import * as React from "react";
import { Icon, addIcon } from "@iconify/react";
import { cn } from "../../lib/utils.js";
import { BUNDLED_PROVIDER_ICONS } from "../../lib/provider-icons-bundle.js";

// Register all bundled authentic provider icons with Iconify on load
for (const [name, iconData] of Object.entries(BUNDLED_PROVIDER_ICONS)) {
  try {
    addIcon(name, iconData);
  } catch {}
}

export type ProviderIconId =
  | "claude"
  | "codex"
  | "antigravity"
  | "gemini"
  | "opencodego"
  | "opencode"
  | "openrouter"
  | "deepseek"
  | "mimo"
  | "xiaomi"
  | "kimi"
  | "moonshot"
  | "glm"
  | "zhipu"
  | "minimax"
  | "grok"
  | "xai"
  | "openai"
  | string;

export interface ProviderIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  provider: ProviderIconId;
  size?: number;
  className?: string;
}

const PROVIDER_ICON_MAP: Record<string, { icon: string; colorClass: string }> = {
  openai: { icon: "simple-icons:openai", colorClass: "text-[#10a37f]" },
  codex: { icon: "simple-icons:openai", colorClass: "text-[#5c82ff]" },
  claude: { icon: "simple-icons:anthropic", colorClass: "text-[#da7756]" },
  anthropic: { icon: "simple-icons:anthropic", colorClass: "text-[#da7756]" },
  antigravity: { icon: "simple-icons:googlegemini", colorClass: "text-[#38bdf8]" },
  gemini: { icon: "simple-icons:googlegemini", colorClass: "text-[#38bdf8]" },
  opencodego: { icon: "simple-icons:opencode", colorClass: "text-emerald-400" },
  opencode: { icon: "simple-icons:opencode", colorClass: "text-emerald-400" },
  openrouter: { icon: "simple-icons:openrouter", colorClass: "text-indigo-400" },
  deepseek: { icon: "simple-icons:deepseek", colorClass: "text-[#0284c7]" },
  mimo: { icon: "simple-icons:xiaomi", colorClass: "text-[#ff6900]" },
  xiaomi: { icon: "simple-icons:xiaomi", colorClass: "text-[#ff6900]" },
  kimi: { icon: "simple-icons:kimi", colorClass: "text-purple-400" },
  moonshot: { icon: "simple-icons:kimi", colorClass: "text-purple-400" },
  glm: { icon: "thesvg:zhipu", colorClass: "text-blue-500" },
  zhipu: { icon: "thesvg:zhipu", colorClass: "text-blue-500" },
  minimax: { icon: "simple-icons:minimax", colorClass: "text-rose-500" },
  grok: { icon: "simple-icons:x", colorClass: "text-zinc-100" },
  xai: { icon: "simple-icons:x", colorClass: "text-zinc-100" },
};

export function ProviderIcon({ provider, size = 18, className, ...props }: ProviderIconProps) {
  const norm = provider.toLowerCase();
  const matched = Object.entries(PROVIDER_ICON_MAP).find(([key]) => norm.includes(key));

  if (matched) {
    const { icon, colorClass } = matched[1];
    return (
      <span
        className={cn("inline-flex items-center justify-center shrink-0", colorClass, className)}
        {...props}
      >
        <Icon icon={icon} width={size} height={size} />
      </span>
    );
  }

  // If provider is a direct Iconify identifier (e.g. "logos:openai", "simple-icons:mistral")
  if (provider.includes(":")) {
    return (
      <span
        className={cn("inline-flex items-center justify-center shrink-0 text-zinc-400", className)}
        {...props}
      >
        <Icon icon={provider} width={size} height={size} />
      </span>
    );
  }

  // Fallback generic AI chip
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 text-zinc-400", className)}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </svg>
    </span>
  );
}
