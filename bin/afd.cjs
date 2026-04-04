#!/usr/bin/env node
const { execFileSync } = require("child_process");
const { resolve } = require("path");

const cli = resolve(__dirname, "..", "src", "cli.ts");

try {
  execFileSync("bun", ["run", cli, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
} catch (e) {
  if (e.status != null) process.exit(e.status);
  console.error("afd requires Bun runtime. Install: https://bun.sh");
  process.exit(1);
}
