import * as React from "react";
import { cn } from "../../lib/utils.js";

export type ProviderIconId =
  | "claude"
  | "codex"
  | "antigravity"
  | "opencodego"
  | "opencode"
  | "openrouter"
  | "deepseek"
  | "mimo"
  | "kimi"
  | "glm"
  | "minimax"
  | "grok"
  | string;

export interface ProviderIconProps extends React.SVGAttributes<SVGElement> {
  provider: ProviderIconId;
  size?: number;
  className?: string;
}

export function ProviderIcon({ provider, size = 18, className, ...props }: ProviderIconProps) {
  const norm = provider.toLowerCase();

  if (norm.includes("claude") || norm.includes("anthropic")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#da7756] shrink-0", className)}
        {...props}
      >
        <path d="m4.84 6.77 4.19 3.03-.4 1.7-4.87-.72-.34-1.22 1.42-2.79zm-.8 5.6 4.9.46.22 1.74-4.66 1.7-.93-.86.47-3.04zm4.1 3.84 3.73-3.2 1.54.83-2.3 4.34-1.2.33-1.77-2.3zm5.72-2.18.24-4.93 1.62-.64 2.12 4.41-.67 1.09-3.31.07zm3.17-5.59-4.32-2.43.32-1.72 4.8.96.48 1.18-1.28 2.01zm-5.63-3.77-1.13 4.8-1.58.1-1.63-4.64.92-.88 3.42.62z" />
        <path
          d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"
          opacity="0.15"
        />
      </svg>
    );
  }

  if (norm.includes("codex") || norm.includes("openai") || norm.includes("gpt")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-[#5c82ff] shrink-0", className)}
        {...props}
      >
        <path d="M19.15 15.68a5.25 5.25 0 0 0-1.89-6.38 5.34 5.34 0 0 0-5.74-.29 5.25 5.25 0 0 0-7.3 2.13 5.34 5.34 0 0 0 .54 5.72 5.25 5.25 0 0 0 5.4 3.25 5.34 5.34 0 0 0 5.2-2.43 5.25 5.25 0 0 0 3.79-2z" />
        <path d="M14.5 12a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5z" />
      </svg>
    );
  }

  if (norm.includes("antigravity") || norm.includes("gemini") || norm.includes("google")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={cn("text-[#38bdf8] shrink-0", className)}
        {...props}
      >
        <path
          d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
          fill="currentColor"
        />
        <circle cx="12" cy="12" r="3" fill="#ffffff" fillOpacity="0.4" />
      </svg>
    );
  }

  if (norm.includes("opencode")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-emerald-400 shrink-0", className)}
        {...props}
      >
        <rect width="18" height="18" x="3" y="3" rx="4" />
        <path d="m9 10 2 2-2 2" />
        <path d="M13 14h2" />
      </svg>
    );
  }

  if (norm.includes("deepseek")) {
    // DeepSeek Blue Whale / Wave glyph
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#0284c7] shrink-0", className)}
        {...props}
      >
        <path d="M12 3c-4.97 0-9 4.03-9 9 0 3.32 1.8 6.22 4.47 7.77.34.2.78.07.98-.27.2-.34.07-.78-.27-.98C5.83 17.27 4.2 14.78 4.2 12c0-4.31 3.49-7.8 7.8-7.8s7.8 3.49 7.8 7.8c0 2.21-.92 4.21-2.4 5.64l-1.4-1.4a5.98 5.98 0 0 0 1.8-4.24c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 1.66.67 3.16 1.76 4.24l-1.42 1.42A7.96 7.96 0 0 1 6 12c0-3.31 2.69-6 6-6s6 2.69 6 6c0 1.84-.83 3.49-2.14 4.59l1.42 1.42A9.97 9.97 0 0 0 21 12c0-4.97-4.03-9-9-9z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (norm.includes("openrouter")) {
    // OpenRouter Connected Nodes
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-indigo-400 shrink-0", className)}
        {...props}
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <circle cx="18" cy="6" r="3" />
        <path d="M6 9v3a3 3 0 0 0 3 3h6" />
        <path d="M18 9v6" />
      </svg>
    );
  }

  if (norm.includes("mimo") || norm.includes("xiaomi")) {
    // Xiaomi Mi Logo Orange Mark
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-[#ff6900] shrink-0", className)}
        {...props}
      >
        <rect width="20" height="20" x="2" y="2" rx="5" fill="#ff6900" />
        <path d="M7 8h2v8H7zm4 0h4a2 2 0 0 1 2 2v6h-2v-5a1 1 0 0 0-1-1h-1v6h-2z" fill="#ffffff" />
      </svg>
    );
  }

  if (norm.includes("kimi") || norm.includes("moonshot")) {
    // Moonshot Kimi Star & Crescent
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-purple-400 shrink-0", className)}
        {...props}
      >
        <path d="M12 2l2.4 5.6L20 10l-4.2 4.1 1 5.9-4.8-2.8L7.2 20l1-5.9L4 10l5.6-2.4z" />
      </svg>
    );
  }

  if (norm.includes("glm") || norm.includes("zhipu")) {
    // Zhipu GLM Blue Tech Mark
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-blue-500 shrink-0", className)}
        {...props}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5L4.5 9.75 2 11l10 5 10-5-2.5-1.25L12 13.5zm0 4.5l-7.5-3.75L2 15.5l10 5 10-5-2.5-1.25L12 18z" />
      </svg>
    );
  }

  if (norm.includes("grok") || norm.includes("xai")) {
    // xAI Grok X Mark
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-zinc-100 shrink-0", className)}
        {...props}
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (norm.includes("minimax")) {
    // MiniMax Red Wave
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("text-rose-500 shrink-0", className)}
        {...props}
      >
        <path d="M4 18V6l4 5 4-5v12h-2v-7l-2 2.5L6 11v7H4zm10 0V6l4 5 4-5v12h-2v-7l-2 2.5-2-2.5v7h-2z" />
      </svg>
    );
  }

  // Fallback generic AI model chip
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-zinc-400 shrink-0", className)}
      {...props}
    >
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}
