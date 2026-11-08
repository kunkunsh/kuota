import * as React from "react";
import { cn } from "../../lib/utils.js";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface DropdownSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly DropdownOption<T>[];
  labelPrefix?: string;
  className?: string;
  popoverWidth?: string;
}

export function DropdownSelect<T extends string = string>({
  value,
  onChange,
  options,
  labelPrefix,
  className,
  popoverWidth = "min-w-[230px]",
}: DropdownSelectProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none",
          "bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 shadow-2xs",
          "hover:border-slate-400 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800/60",
          "focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
          isOpen && "ring-1 ring-emerald-500/40 border-emerald-500/50",
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {labelPrefix && (
          <span className="text-slate-500 dark:text-zinc-400 font-normal shrink-0">
            {labelPrefix}
          </span>
        )}

        {selectedOption?.icon && (
          <span className="shrink-0 flex items-center justify-center">{selectedOption.icon}</span>
        )}

        <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[140px]">
          {selectedOption ? selectedOption.label : value}
        </span>

        {selectedOption?.badge && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/60 font-mono">
            {selectedOption.badge}
          </span>
        )}

        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-emerald-500",
          )}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden shadow-xl",
            "bg-white dark:bg-[#111113] border border-slate-200 dark:border-zinc-800 p-1 space-y-0.5",
            "max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150",
            popoverWidth,
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-slate-100 dark:bg-zinc-800/90 text-slate-900 dark:text-zinc-100 font-semibold"
                    : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100/70 dark:hover:bg-zinc-800/60",
                )}
              >
                {option.icon && (
                  <span className="shrink-0 flex items-center justify-center p-0.5 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800">
                    {option.icon}
                  </span>
                )}

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="truncate">{option.label}</span>
                    {option.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300/60 dark:border-zinc-700/60 font-mono shrink-0">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  {option.sublabel && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize truncate">
                      {option.sublabel}
                    </span>
                  )}
                </div>

                {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
