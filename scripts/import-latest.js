#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");

function usage() {
  console.log(`Usage: node scripts/import-latest.js [--year 2026] [--write]

Finds the newest data/raw/YYYY/*.txt file and passes it to scripts/import-notes.js.
Preview is the default. Add --write to update data/matches-YYYY.json.`);
}

function parseArgs(argv) {
  const args = { year: String(new Date().getFullYear()), write: false, help: false };

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

  if (!/^\d{4}$/.test(String(args.year))) throw new Error("--year must be a 4 digit year.");
  return args;
}

function latestRawNote(year) {
  const rawDir = path.join(REPO_ROOT, "data", "raw", String(year));
  if (!fs.existsSync(rawDir)) return null;

  const files = fs
    .readdirSync(rawDir)
    .filter((file) => file.endsWith(".txt"))
    .sort();

  const latest = files.at(-1);
  return latest ? path.join(rawDir, latest) : null;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const latest = latestRawNote(args.year);
  if (!latest) {
    console.error(`No raw note files found in data/raw/${args.year}.`);
    process.exit(1);
  }

  const relativeLatest = path.relative(REPO_ROOT, latest);
  console.log(`Importing latest raw note: ${relativeLatest}`);

  const importArgs = [path.join("scripts", "import-notes.js"), relativeLatest, "--year", args.year];
  if (args.write) importArgs.push("--write");

  const result = spawnSync(process.execPath, importArgs, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}

module.exports = { latestRawNote, parseArgs };

if (require.main === module) {
  main();
}
