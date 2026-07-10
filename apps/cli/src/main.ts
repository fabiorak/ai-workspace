#!/usr/bin/env node

import { runCli } from "./cli.ts";

const MAX_STDIN_BYTES = 64 * 1024;

const exitCode = await runCli(process.argv.slice(2), {
  environment: process.env,
  stdout: (content) => process.stdout.write(content),
  stderr: (content) => process.stderr.write(content),
  stdin: async () => {
    const chunks: Buffer[] = [];
    let byteLength = 0;

    for await (const chunk of process.stdin) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.byteLength;
      if (byteLength > MAX_STDIN_BYTES) {
        throw new Error(
          `Standard input exceeds the ${MAX_STDIN_BYTES} byte safety limit`,
        );
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  },
});

process.exitCode = exitCode;
