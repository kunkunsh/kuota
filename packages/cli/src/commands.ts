import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { Command, Options } from "@effect/cli";
import * as NodeContext from "@effect/platform-node/NodeContext";
import { Effect, Option } from "effect";
import type { ProviderId, QuotaSnapshot } from "@kuota/core";
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
  const windows = snapshot.windows.map(
    (window) =>
      `${window.windowId}: ${window.remainingPercent === null ? "unknown" : `${window.remainingPercent}% remaining`}${window.resetAt ? ` · resets ${window.resetAt}` : ""}`,
  );
  return `${snapshot.provider}: ${snapshot.status}\n  ${windows.join("\n  ") || "quota unknown"}`;
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
      const tools = PROVIDER_METADATA.map((item) => ({
        provider: item.id,
        executable: item.id === "antigravity" ? "agy" : item.id,
        installed: hasBinary(item.id === "antigravity" ? "agy" : item.id),
        adapterImplemented: item.implemented,
      }));
      if (json) output.writeStdout(JSON.stringify({ schemaVersion: 1, tools }));
      else
        output.writeStdout(
          tools
            .map(
              (tool) =>
                `${tool.provider}: executable ${tool.installed ? "present" : "not found"}, adapter ${tool.adapterImplemented ? "ready" : "planned"}`,
            )
            .join("\n"),
        );
    }),
  );

  const tui = Command.make("tui", {}, () => Effect.promise(startTui));

  const root = Command.make("kuota", {}, () => Effect.void).pipe(
    Command.withSubcommands([status, providerList, doctor, tui]),
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
