import * as React from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "../../lib/utils.js";

export interface AnimatedCodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  highlightLines?: readonly number[];
  streamAnimation?: boolean;
  className?: string;
}

// Simple deterministic JSON token highlighter
function highlightJson(line: string): React.ReactNode {
  // Key regex "key":
  const parts = line.split(/("(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?)/g);

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('"') && part.endsWith('"')) {
      // Check if it's a key (followed by colon in original context or looks like key)
      return (
        <span key={i} className="text-cyan-300">
          {part}
        </span>
      );
    }
    if (part === "true" || part === "false") {
      return (
        <span key={i} className="text-amber-400 font-semibold">
          {part}
        </span>
      );
    }
    if (part === "null") {
      return (
        <span key={i} className="text-red-400 italic">
          {part}
        </span>
      );
    }
    if (/^-?\d+(?:\.\d+)?$/.test(part)) {
      return (
        <span key={i} className="text-emerald-400 font-mono">
          {part}
        </span>
      );
    }
    return (
      <span key={i} className="text-zinc-300">
        {part}
      </span>
    );
  });
}

export function AnimatedCodeBlock({
  code,
  language = "json",
  highlightLines = [],
  streamAnimation = true,
  className,
  ...props
}: AnimatedCodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(streamAnimation ? 0 : 9999);

  const lines = React.useMemo(() => code.split("\n"), [code]);

  // Progressive streaming animation when opened
  React.useEffect(() => {
    if (!streamAnimation) {
      setVisibleCount(lines.length);
      return;
    }
    setVisibleCount(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      setVisibleCount(current);
      if (current >= lines.length) {
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [lines, streamAnimation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error in test/headless
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-[#09090b] border border-zinc-800 shadow-2xl overflow-hidden font-mono text-xs flex flex-col",
        className,
      )}
      {...props}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            {language}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">({lines.length} lines)</span>
        </div>

        <button
          type="button"
          className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area with Staggered Lines */}
      <div className="p-4 overflow-x-auto max-h-[380px] space-y-0.5 leading-relaxed">
        {lines.map((line, idx) => {
          if (idx >= visibleCount) return null;
          const isHighlighted = highlightLines.includes(idx + 1);
          return (
            <div
              key={idx}
              className={cn(
                "flex items-start space-x-3 px-1.5 py-0.5 rounded transition-colors",
                isHighlighted
                  ? "bg-amber-500/10 border-l-2 border-amber-400 pl-2"
                  : "hover:bg-zinc-900/60",
              )}
            >
              <span className="text-zinc-400 select-none text-right w-6 shrink-0 text-[10px] pt-0.5">
                {idx + 1}
              </span>
              <span className="whitespace-pre">{highlightJson(line)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
