#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { assignMissingSessionIds } = require("./session-ids");
const { formatMatchesData } = require("./import-notes");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

function parseArgs(argv) {
  const args = { year: null, write: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return args;
}

function matchesFiles(year) {
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => /^matches-\d{4}\.json$/.test(name))
    .filter((name) => !year || name === `matches-${year}.json`)
    .sort()
    .map((name) => path.join(DATA_DIR, name));
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/migrate-session-ids.js [--year 2026] [--write]");
    process.exit(0);
  }

  for (const filePath of matchesFiles(args.year)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const changed = assignMissingSessionIds(data.matches);
    if (args.write && changed) fs.writeFileSync(filePath, formatMatchesData(data));
    console.log(`${path.relative(REPO_ROOT, filePath)}: ${changed} change(s)`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { matchesFiles, parseArgs };
