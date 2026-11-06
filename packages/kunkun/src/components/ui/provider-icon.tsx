import * as React from "react";
import { cn } from "../../lib/utils.js";

export type ProviderIconId = "claude" | "codex" | "antigravity" | "opencode" | "gemini" | string;

export interface ProviderIconProps extends React.SVGAttributes<SVGElement> {
  provider: ProviderIconId;
  size?: number;
  className?: string;
}

export function ProviderIcon({
  provider,
  size = 18,
  className,
  ...props
}: ProviderIconProps) {
  const norm = provider.toLowerCase();

  if (norm.includes("claude") || norm.includes("anthropic")) {
    // Official Anthropic Asterisk / Sunburst SVG
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
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.15" />
      </svg>
    );
  }

  if (norm.includes("codex") || norm.includes("openai") || norm.includes("gpt")) {
    // Official OpenAI Spiral Glyph SVG
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
    // Official Google Gemini / Antigravity Sparkle Star SVG
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
    // OpenCode Terminal Glyph SVG
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
