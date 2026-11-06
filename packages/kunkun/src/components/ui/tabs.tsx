import * as React from "react";
import { cn } from "../../lib/utils.js";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}
const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  defaultValue = "",
  className,
  children,
  ...props
}: {
  value?: string;
  onValueChange?: (val: string) => void;
  defaultValue?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value ?? internal;
  const change = onValueChange ?? setInternal;
  return (
    <TabsContext.Provider value={{ value: current, onValueChange: change }}>
      <div className={cn("flex flex-col space-y-4", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-start rounded-lg bg-zinc-900 p-1 text-zinc-400 border border-zinc-800",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-zinc-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        active
          ? "bg-zinc-800 text-zinc-100 shadow-sm font-semibold"
          : "hover:bg-zinc-800/50 hover:text-zinc-200 text-zinc-400",
        className,
      )}
      onClick={() => ctx?.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div
      className={cn(
        "ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
