import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { Command, Options } from "@effect/cli";
import * as NodeContext from "@effect/platform-node/NodeContext";
import { Effect, Option } from "effect";
import { formatPromptString, type ProviderId, type QuotaSnapshot } from "@kuota/core";
import { historyCommands, type CliRuntime } from "./history-commands.js";
import {
  PROVIDER_METADATA,
  builtInProviders,
  isProviderId,
  readAll,
  type QuotaProvider,
} from "@kuota/providers";

export interface CliOutput {
  writeStdout(value: string): void;
  writeStderr(value: string): void;
}

const processOutput: CliOutput = {
  writeStdout: (value) => process.stdout.write(`${value}\n`),
  writeStderr: (value) => process.stderr.write(`${value}\n`),
};

export interface CliEnvelope {
  schemaVersion: 1;
  generatedAt: string;
  providers: readonly QuotaSnapshot[];
  errors: readonly { code: string }[];
}

function envelope(
  providers: readonly QuotaSnapshot[],
  errors: readonly { code: string }[] = [],
): CliEnvelope {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), providers, errors };
}

function showHuman(snapshot: QuotaSnapshot): string {
  if (snapshot.status !== "ok" && snapshot.status !== "partial") {
    return `${snapshot.provider}: ${snapshot.status} (${snapshot.errorCode ?? "unknown"})`;
  }
  const lines: string[] = [];
  if (snapshot.balance && snapshot.balance.balances.length > 0) {
    for (const b of snapshot.balance.balances) {
      const sym = b.currency === "USD" ? "$" : b.currency === "CNY" ? "¥" : `${b.currency} `;
      let s = `${sym}${b.totalBalance.toFixed(2)}`;
      if (b.grantedBalance != null && b.grantedBalance > 0) {
        s += ` (grant: ${sym}${b.grantedBalance.toFixed(2)})`;
      }
      lines.push(`Balance: ${s}`);
    }
    if (snapshot.balance.usage != null) {
      lines.push(`Usage: $${snapshot.balance.usage.toFixed(2)}`);
    }
  }
  if (snapshot.windows.length > 0) {
    const windows = snapshot.windows.map(
      (window) =>
        `${window.windowId}: ${window.remainingPercent === null ? "unknown" : `${window.remainingPercent}% remaining`}${window.resetAt ? ` · resets ${window.resetAt}` : ""}`,
    );
    lines.push(...windows);
  }
  return `${snapshot.provider}: ${snapshot.status}\n  ${lines.join("\n  ") || "quota unknown"}`;
}

/** An executable presence check, not a logged-in/account-readiness claim. */
function hasBinary(name: string): boolean {
  for (const folder of (process.env.PATH ?? "").split(delimiter)) {
    if (!folder) continue;
    try {
      accessSync(join(folder, name), constants.X_OK);
      return true;
    } catch {
      // Continue to the next PATH directory.
    }
  }
  return false;
}

export async function runCli(
  args: readonly string[],
  output: CliOutput = processOutput,
  providers: readonly QuotaProvider[] = builtInProviders(),
  startTui: () => Promise<void> = async () => {
    const module = await import("@kuota/tui");
    return module.startTui();
  },
  runtime: CliRuntime = {},
): Promise<number> {
  let exitCode = 0;

  const status = Command.make(
    "status",
    { provider: Options.optional(Options.text("provider")), json: Options.boolean("json") },
    ({ provider, json }) =>
      Effect.gen(function* () {
        const selector = Option.getOrUndefined(provider);
        if (selector !== undefined && !isProviderId(selector)) {
          exitCode = 2;
          if (json)
            output.writeStdout(JSON.stringify(envelope([], [{ code: "UNKNOWN_PROVIDER" }])));
          else output.writeStderr("Unknown provider. Run `kuota providers` to see supported IDs.");
          return;
        }
        const ids: ProviderId[] = selector
          ? [selector as ProviderId]
          : PROVIDER_METADATA.map((item) => item.id);
        const snapshots = yield* readAll(ids, providers);
        if (json) output.writeStdout(JSON.stringify(envelope(snapshots)));
        else output.writeStdout(snapshots.map(showHuman).join("\n"));
      }),
  );

  const providerList = Command.make("providers", { json: Options.boolean("json") }, ({ json }) =>
    Effect.sync(() => {
      if (json)
        output.writeStdout(JSON.stringify({ schemaVersion: 1, providers: PROVIDER_METADATA }));
      else
        output.writeStdout(
          PROVIDER_METADATA.map(
            (item) =>
              `${item.id.padEnd(12)} ${item.label} ${item.implemented ? "implemented" : "planned"}`,
          ).join("\n"),
        );
    }),
  );

  const doctor = Command.make("doctor", { json: Options.boolean("json") }, ({ json }) =>
    Effect.sync(() => {
      const tools = PROVIDER_METADATA.map((item) => {
        const isCli = !item.envKeys || item.envKeys.length === 0;
        const exeName = item.id === "antigravity" ? "agy" : item.id;
        const hasEnv = item.envKeys?.some((k) => Boolean(process.env[k]));
        const ready = isCli ? hasBinary(exeName) : hasEnv;
        return {
          provider: item.id,
          type: item.billingModel ?? (isCli ? "subscription" : "balance"),
          installed: ready,
          status: ready ? "ready" : isCli ? "binary missing" : "api key missing",
          adapterImplemented: item.implemented,
        };
      });
      if (json) output.writeStdout(JSON.stringify({ schemaVersion: 1, tools }));
      else
        output.writeStdout(
          tools
            .map(
              (tool) =>
                `${tool.provider.padEnd(12)}: ${tool.status.padEnd(16)} (adapter ${tool.adapterImplemented ? "ready" : "planned"})`,
            )
            .join("\n"),
        );
    }),
  );

  const tui = Command.make("tui", {}, () => Effect.promise(startTui));

  const prompt = Command.make(
    "prompt",
    {
      provider: Options.optional(Options.text("provider")),
      format: Options.optional(Options.text("format")),
    },
    ({ provider, format }) =>
      Effect.gen(function* () {
        const selector = Option.getOrUndefined(provider);
        const fmt = (Option.getOrUndefined(format) ?? "minimal") as "minimal" | "detailed" | "starship";
        const ids: ProviderId[] = selector && isProviderId(selector)
          ? [selector as ProviderId]
          : PROVIDER_METADATA.map((item) => item.id);
        const snapshots = yield* readAll(ids, providers);
        const text = formatPromptString(snapshots, fmt, selector);
        if (text) {
          output.writeStdout(text);
        }
      }),
  );

  const makeWebCommand = (name: string) =>
    Command.make(
      name,
      {
        port: Options.optional(Options.integer("port")),
        host: Options.optional(Options.text("host")),
        noOpen: Options.boolean("no-open"),
      },
      ({ port, host, noOpen }) =>
        Effect.promise(async () => {
          const { startWebServer } = await import("./web-server.js");
          await startWebServer(
            {
              port: Option.getOrUndefined(port),
              host: Option.getOrUndefined(host),
              open: !noOpen,
            },
            output,
            providers,
          );
        }),
    );

  const web = makeWebCommand("web");
  const serve = makeWebCommand("serve");

  const root = Command.make("kuota", {}, () =>
    Effect.promise(async () => {
      if (process.stdout.isTTY) {
        await startTui();
      } else {
        output.writeStdout(
          "Kuota — Multi-provider AI Quota & Usage Monitor\nRun `kuota --help` for available commands, or `kuota web` to launch the web UI.",
        );
      }
    }),
  ).pipe(
    Command.withSubcommands([
      status,
      prompt,
      providerList,
      doctor,
      tui,
      web,
      serve,
      ...historyCommands(output, providers, runtime, (code) => {
        exitCode = code;
      }),
    ]),
  );
  const cli = Command.run(root, { name: "Kuota", version: "0.1.0" });

  try {
    await Effect.runPromise(
      cli([process.execPath, "kuota", ...args]).pipe(Effect.provide(NodeContext.layer)),
    );
  } catch (error) {
    exitCode = 1;
    if (args.includes("--json"))
      output.writeStdout(JSON.stringify(envelope([], [{ code: "CLI_ERROR" }])));
    else if (args[0] === "tui" && String(error).includes("TUI requires an interactive terminal")) {
      output.writeStderr(
        "Kuota TUI requires an interactive terminal; use `kuota status --json` in non-TTY contexts.",
      );
    } else output.writeStderr("Unable to execute command. Run `kuota --help` for usage.");
  }
  return exitCode;
}
