#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const { assignMissingMatchIds } = require("./match-ids");
const { formatMatchesData } = require("./import-notes");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

function usage() {
  console.log(`Usage: node scripts/migrate-match-ids.js [--year 2026] [--write]

Preview is the default. Add --write to update data/matches-YYYY.json.`);
}

function parseArgs(argv) {
  const args = { year: null, write: false, help: false };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (args.year && !/^\d{4}$/.test(String(args.year))) throw new Error("--year must be a 4 digit year.");
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
    usage();
    return;
  }

  const files = matchesFiles(args.year);
  if (!files.length) {
    console.log(args.year ? `No data/matches-${args.year}.json file found.` : "No matches files found.");
    return;
  }

  for (const filePath of files) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const assigned = assignMissingMatchIds(data.matches || []);
    const relative = path.relative(REPO_ROOT, filePath);

    if (args.write && assigned) fs.writeFileSync(filePath, formatMatchesData(data));
    console.log(`${relative}: ${assigned} id(s) ${args.write ? "assigned" : "would be assigned"}.`);
  }

  if (!args.write) console.log("Preview only. Re-run with --write to update JSON.");
}

if (require.main === module) {
  main();
}

module.exports = { matchesFiles, parseArgs };
