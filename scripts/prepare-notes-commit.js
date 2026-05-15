#!/usr/bin/env node

const { spawnSync } = require("child_process");

function run(command, args) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function main() {
  const extraArgs = process.argv.slice(2);
  const yearArgs = extraArgs.length ? extraArgs : ["--year", "2026"];

  run("npm", ["run", "notes:preview-new", "--", ...yearArgs]);
  run("npm", ["run", "notes:import-new", "--", ...yearArgs]);
  run("npm", ["run", "decks:review"]);
  run("npm", ["run", "check"]);
  run("npm", ["test"]);
  run("git", ["diff", "--stat"]);
}

if (require.main === module) {
  main();
}
