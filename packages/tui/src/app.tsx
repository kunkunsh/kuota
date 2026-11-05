import { Box, Panel, Text, useInput } from "@uniview/tui-react";
import type { ReactElement } from "react";
import type { ProviderId, QuotaSnapshot } from "@kuota/core";

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
}

export function QuotaApp(props: QuotaAppProps): ReactElement {
  useInput((input) => {
    if (input === "q") props.onQuit();
    else if (input === "r") props.onRefresh();
    else if (input === "a") props.onSelect(null);
    else if (input === "1") props.onSelect("codex");
    else if (input === "2") props.onSelect("claude");
    else if (input === "3") props.onSelect("antigravity");
  });

  const visible = props.selected
    ? props.snapshots.filter((snapshot) => snapshot.provider === props.selected)
    : props.snapshots;

  return (
    <Panel title="Kuota · AI subscription usage" focused>
      <Box flexDirection="column">
        <Text bold>Kuota</Text>
        <Text>
          {props.loading ? "Refreshing provider quotas…" : "Live local provider snapshots"}
        </Text>
        <Text> </Text>
        {visible.length === 0 && <Text>{props.loading ? "Loading…" : "No provider results"}</Text>}
        {visible.map((snapshot) => (
          <Box key={snapshot.provider} flexDirection="column">
            <Text bold>{`${LABELS[snapshot.provider]} · ${snapshot.status}`}</Text>
            {snapshot.windows.length === 0 && (
              <Text>
                {snapshot.errorCode ? safeTerminalText(snapshot.errorCode) : "quota unknown"}
              </Text>
            )}
            {snapshot.windows.map((window) => (
              <Text key={window.windowId}>
                {`  ${safeTerminalText(window.windowId)}: ${window.remainingPercent === null ? "unknown" : `${window.remainingPercent}% remaining`}${window.resetAt ? ` · resets ${window.resetAt}` : ""}`}
              </Text>
            ))}
            <Text> </Text>
          </Box>
        ))}
        <Text>r refresh · 1/2/3 filter · a all · q quit</Text>
      </Box>
    </Panel>
  );
}
