import { Effect } from "effect";
import { render } from "@uniview/tui-react";
import { PROVIDER_METADATA, createQuotaService } from "@kuota/providers";
import type { ProviderId, QuotaSnapshot } from "@kuota/core";
import { defaultHistoryDirectory } from "@kuota/history";
import { QuotaApp } from "./app.js";
import { loadHistoryView, type HistoryView } from "./history-view.js";

export { QuotaApp } from "./app.js";

export function ensureInteractiveTerminal(inputIsTty: boolean, outputIsTty: boolean): void {
  if (!inputIsTty || !outputIsTty) {
    throw new Error(
      "Kuota TUI requires an interactive terminal; run `kuota status --json` instead.",
    );
  }
}

/** Interactive entrypoint. Consumers of @kuota/core never import or start this. */
export async function startTui(): Promise<void> {
  ensureInteractiveTerminal(Boolean(process.stdin.isTTY), Boolean(process.stdout.isTTY));

  return new Promise<void>((resolve, reject) => {
    let stopped = false;
    let loading = true;
    let selected: ProviderId | null = null;
    let selectedWindow: string | null = null;
    let history: HistoryView = { series: {}, forecasts: [] };
    let snapshots: readonly QuotaSnapshot[] = [];
    let app: ReturnType<typeof render> | undefined;
    // One process-local service: TTL cache, singleflight, 429 cooldown and stale handling.
    const service = createQuotaService();

    const rerender = (): void => {
      if (!app || stopped) return;
      app.render(
        <QuotaApp
          snapshots={snapshots}
          loading={loading}
          selected={selected}
          selectedWindow={selectedWindow}
          series={history.series}
          forecasts={history.forecasts}
          onSelectWindow={(windowId) => {
            selectedWindow = windowId;
            rerender();
          }}
          onRefresh={() => {
            void refresh();
          }}
          onQuit={quit}
          onSelect={(provider) => {
            selected = provider;
            selectedWindow = null;
            rerender();
          }}
        />,
      );
    };

    const quit = (): void => {
      if (stopped) return;
      stopped = true;
      process.off("SIGINT", quit);
      queueMicrotask(() => {
        try {
          app?.destroy();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };

    const refresh = async (): Promise<void> => {
      if (stopped || loading) return;
      loading = true;
      rerender();
      try {
        const observations = await Effect.runPromise(
          service.read(
            PROVIDER_METADATA.map(({ id }) => id),
            { force: true },
          ),
        );
        snapshots = observations.map((observation) => observation.snapshot);
        history = await loadHistoryView(defaultHistoryDirectory(), new Date());
      } catch {
        // A provider failure is normally isolated by readAll. Preserve prior state on unexpected crash.
      } finally {
        loading = false;
        rerender();
      }
    };

    try {
      app = render(
        <QuotaApp
          snapshots={snapshots}
          loading
          selected={selected}
          selectedWindow={selectedWindow}
          series={history.series}
          forecasts={history.forecasts}
          onSelectWindow={(windowId) => {
            selectedWindow = windowId;
            rerender();
          }}
          onRefresh={() => {
            void refresh();
          }}
          onQuit={quit}
          onSelect={(provider) => {
            selected = provider;
            selectedWindow = null;
            rerender();
          }}
        />,
      );
      process.on("SIGINT", quit);
      loading = false;
      void refresh();
    } catch (error) {
      process.off("SIGINT", quit);
      reject(error);
    }
  });
}
