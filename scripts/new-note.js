#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function usage() {
  console.log(`Usage: npm run notes:new -- YYYY-MM-DD description

Example:
  npm run notes:new -- 2026-04-13 magic`);
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function main() {
  const [, , date, ...descriptionParts] = process.argv;
  const description = descriptionParts.join(" ").trim();

  if (!date || !description || date === "--help" || date === "-h") {
    usage();
    process.exit(date ? 0 : 1);
  }

  if (!validIsoDate(date)) {
    console.error(`Expected date as YYYY-MM-DD, got "${date}".`);
    process.exit(1);
  }

  const year = date.slice(0, 4);
  const fileName = `${date}-${normalise(description)}.txt`;
  const filePath = path.join(REPO_ROOT, "data", "raw", year, fileName);

  if (fs.existsSync(filePath)) {
    console.error(`${path.relative(REPO_ROOT, filePath)} already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${date} ${description}

Player - deck - win
Player - deck

---

Player - deck - win
Player - deck
`
  );

  console.log(`Created ${path.relative(REPO_ROOT, filePath)}`);
}

if (require.main === module) {
  main();
}
