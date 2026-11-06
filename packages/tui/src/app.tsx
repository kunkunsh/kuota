import { Box, Panel, Text, useInput } from "@uniview/tui-react";
import * as React from "react";
import type { ReactElement } from "react";
import {
  windowProfile,
  type ProviderId,
  type QuotaForecastV1,
  type QuotaSnapshot,
  type QuotaWindow,
} from "@kuota/core";
import {
  barCells,
  describeExhaustion,
  nextWindow,
  seriesKey,
  sparkline,
  windowPace,
  type BarCell,
} from "./dashboard.js";

const LABELS: Record<ProviderId, string> = {
  codex: "Codex",
  claude: "Claude Code",
  antigravity: "Antigravity",
};

/** Strip control characters before potentially untrusted provider text reaches a terminal. */
export function safeTerminalText(value: string): string {
  /* eslint-disable no-control-regex -- The purpose of this function is to strip terminal control codes. */
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  /* eslint-enable no-control-regex */
}

export interface QuotaAppProps {
  snapshots: readonly QuotaSnapshot[];
  loading: boolean;
  selected?: ProviderId | null;
  onRefresh(): void;
  onQuit(): void;
  onSelect(provider: ProviderId | null): void;
  /** Optional dashboard data. Absent => the original compact view. */
  forecasts?: readonly QuotaForecastV1[];
  /** Used-percent history keyed by `provider/windowId`, oldest first. */
  series?: Readonly<Record<string, readonly number[]>>;
  selectedWindow?: string | null;
  onSelectWindow?(windowId: string | null): void;
  now?: Date;
}

const PROVIDER_ORDER: readonly ProviderId[] = ["codex", "claude", "antigravity"];
const BAR_WIDTH = 24;

/** Color of remaining balance fill: red when quota is low/critical, yellow when cautious, green when healthy. */
function fillColor(remaining: number): "green" | "yellow" | "red" {
  return remaining <= 15 ? "red" : remaining <= 35 ? "yellow" : "green";
}

function bar(cells: readonly BarCell[], remaining: number): ReactElement {
  // Group runs so each style is one Text node.
  const runs: { kind: BarCell; length: number }[] = [];
  for (const kind of cells) {
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.length += 1;
    else runs.push({ kind, length: 1 });
  }
  return (
    <Box flexDirection="row">
      {runs.map((run, index) =>
        run.kind === "marker" ? (
          <Text key={index} color="white" bold>
            {"┃".repeat(run.length)}
          </Text>
        ) : run.kind === "fill" ? (
          <Text key={index} color={fillColor(remaining)}>
            {"█".repeat(run.length)}
          </Text>
        ) : (
          <Text key={index} dim>
            {"░".repeat(run.length)}
          </Text>
        ),
      )}
    </Box>
  );
}

export function QuotaApp(props: QuotaAppProps): ReactElement {
  const [inspectSnapshot, setInspectSnapshot] = React.useState(false);

  useInput((input) => {
    if (input === "q") props.onQuit();
    else if (input === "r") props.onRefresh();
    else if (input === "a") props.onSelect(null);
    else if (input === "1") props.onSelect("codex");
    else if (input === "2") props.onSelect("claude");
    else if (input === "3") props.onSelect("antigravity");
    else if (input === "s") setInspectSnapshot((prev) => !prev);
    else if (input === "p") {
      const index = props.selected ? PROVIDER_ORDER.indexOf(props.selected) : -1;
      props.onSelect(index === PROVIDER_ORDER.length - 1 ? null : PROVIDER_ORDER[index + 1]!);
    } else if (input === "w") {
      const ids = visible.flatMap((snapshot) => snapshot.windows.map((w) => w.windowId));
      props.onSelectWindow?.(nextWindow([...new Set(ids)], props.selectedWindow ?? null));
    }
  });

  const visible = props.selected
    ? props.snapshots.filter((snapshot) => snapshot.provider === props.selected)
    : props.snapshots;
  const now = props.now ?? new Date();
  const showWindow = (w: QuotaWindow): boolean =>
    !props.selectedWindow || w.windowId === props.selectedWindow;

  return (
    <Panel
      title={
        inspectSnapshot ? "Kuota · Snapshot Provenance Inspector" : "Kuota · AI subscription usage"
      }
      focused
    >
      <Box flexDirection="column">
        <Text bold>{inspectSnapshot ? "Raw Snapshot Inspector" : "Kuota"}</Text>
        <Text>
          {inspectSnapshot
            ? "Field provenance, data source freshness, and raw timestamps"
            : props.loading
              ? "Refreshing provider quotas…"
              : "Live local provider snapshots"}
        </Text>
        <Text> </Text>
        {visible.length === 0 && <Text>{props.loading ? "Loading…" : "No provider results"}</Text>}
        {inspectSnapshot
          ? visible.map((snapshot) => (
              <Box key={snapshot.provider} flexDirection="column">
                <Text
                  bold
                  color="cyan"
                >{`${LABELS[snapshot.provider]} · status: ${snapshot.status}`}</Text>
                <Text>{`  source: ${snapshot.source} · fetchedAt: ${snapshot.fetchedAt}`}</Text>
                {snapshot.errorCode && (
                  <Text color="red">{`  errorCode: ${safeTerminalText(snapshot.errorCode)}`}</Text>
                )}
                {snapshot.windows.filter(showWindow).map((window) => {
                  const profile = windowProfile(snapshot.provider, window.windowId);
                  return (
                    <Box key={window.windowId} flexDirection="column">
                      <Text>{`  [window] ${safeTerminalText(window.windowId)}`}</Text>
                      <Text
                        dim
                      >{`    used: ${window.usedPercent ?? "null"}% | remaining: ${window.remainingPercent ?? "null"}%`}</Text>
                      <Text
                        dim
                      >{`    resetAt: ${window.resetAt ?? "none"} | semantics: ${profile.semantics}`}</Text>
                    </Box>
                  );
                })}
                <Text> </Text>
              </Box>
            ))
          : visible.map((snapshot) => (
              <Box key={snapshot.provider} flexDirection="column">
                <Text bold>{`${LABELS[snapshot.provider]} · ${snapshot.status}`}</Text>
                {snapshot.windows.length === 0 && (
                  <Text>
                    {snapshot.errorCode ? safeTerminalText(snapshot.errorCode) : "quota unknown"}
                  </Text>
                )}
                {snapshot.windows.filter(showWindow).map((window) => {
                  const pace = windowPace(snapshot.provider, window, now);
                  const remaining =
                    window.remainingPercent ??
                    (window.usedPercent !== null ? 100 - window.usedPercent : null);
                  const idealRemaining = pace ? 100 - pace.idealUsedPercent : null;
                  const history =
                    props.series?.[seriesKey(snapshot.provider, window.windowId)] ?? [];
                  const forecast = props.forecasts?.find(
                    (f) => f.provider === snapshot.provider && f.windowId === window.windowId,
                  );
                  return (
                    <Box key={window.windowId} flexDirection="column">
                      <Text>
                        {`  ${safeTerminalText(window.windowId)}: ${remaining === null ? "unknown" : `${Math.round(remaining)}% remaining`}${window.resetAt ? ` · resets ${window.resetAt}` : ""}`}
                      </Text>
                      {remaining !== null && (
                        <Box flexDirection="row">
                          <Text>{"  "}</Text>
                          {bar(barCells(remaining, idealRemaining, BAR_WIDTH), remaining)}
                          <Text>
                            {` ${Math.round(remaining)}% left${idealRemaining !== null && pace ? ` · ideal ${Math.round(idealRemaining)}% left (${pace.quality})` : ""}`}
                          </Text>
                        </Box>
                      )}
                      {props.forecasts !== undefined && (
                        <>
                          {history.length > 0 && (
                            <Text dim>{`  trend ${sparkline(history, 30)}`}</Text>
                          )}
                          <Text dim>{`  ${describeExhaustion(forecast)}`}</Text>
                        </>
                      )}
                    </Box>
                  );
                })}
                <Text> </Text>
              </Box>
            ))}
        <Text>r refresh · 1/2/3/p provider · a all · w window · s snapshot inspect · q quit</Text>
      </Box>
    </Panel>
  );
}
