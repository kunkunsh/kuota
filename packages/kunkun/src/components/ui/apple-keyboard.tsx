import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface AppleKeyProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AppleKey({
  children,
  active = false,
  size = "md",
  className,
  ...props
}: AppleKeyProps) {
  const sizeClasses =
    size === "sm"
      ? "min-w-[20px] h-5 px-1.5 text-[10px]"
      : size === "lg"
        ? "min-w-[36px] h-9 px-3 text-sm"
        : "min-w-[26px] h-6 px-2 text-xs";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-mono font-medium rounded-md",
        "bg-gradient-to-b from-zinc-800 to-zinc-900 text-zinc-300",
        "border border-zinc-700/80 shadow-[0_2px_0_0_#18181b,inset_0_1px_0_0_rgba(255,255,255,0.15)]",
        "hover:from-zinc-700 hover:to-zinc-800 active:translate-y-0.5 active:shadow-[0_0px_0_0_#18181b] transition-all duration-75",
        active &&
          "from-indigo-600 to-indigo-700 text-white border-indigo-500 shadow-[0_1px_0_0_#312e81]",
        sizeClasses,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AppleKeyCombo({
  keys,
  className,
}: {
  keys: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center space-x-1", className)}>
      {keys.map((k, i) => (
        <AppleKey key={i} size="sm">
          {k}
        </AppleKey>
      ))}
    </div>
  );
}
