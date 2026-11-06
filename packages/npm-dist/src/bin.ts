#!/usr/bin/env node
import { runCli } from "../../cli/src/commands.js";

void runCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
