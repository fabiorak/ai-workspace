#!/usr/bin/env node

import { runCli } from "./cli.ts";

const exitCode = await runCli(process.argv.slice(2), {
  environment: process.env,
  stdout: (content) => process.stdout.write(content),
  stderr: (content) => process.stderr.write(content),
});

process.exitCode = exitCode;
