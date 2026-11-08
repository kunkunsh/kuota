import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value ?? 0));
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800",
          className,
        )}
        {...props}
      >
        <div
          className="h-full bg-slate-900 dark:bg-zinc-100 transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";
