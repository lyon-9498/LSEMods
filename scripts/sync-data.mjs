#!/usr/bin/env node
/**
 * Offline sync: copy course/programme JSON from a local LSEMods checkout
 * (or download a release zip) into public/data.
 *
 * Usage:
 *   npm run data:sync -- /path/to/LSEMods/public/data
 *   npm run data:sync -- --from-github
 *
 * Never run scrapers from the live site — scrape offline, then sync here.
 */
import { cp, mkdir, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "public", "data");

const args = process.argv.slice(2);
const fromGithub = args.includes("--from-github");
const srcArg = args.find((a) => !a.startsWith("-"));

async function exists(p) {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(src) {
  if (!(await exists(src))) {
    console.error(`Source not found: ${src}`);
    process.exit(1);
  }
  const index = path.join(src, "index.json");
  if (!(await exists(index))) {
    console.error(`Expected index.json under ${src}`);
    process.exit(1);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await rm(dest, { recursive: true, force: true });
  await cp(src, dest, { recursive: true });
  console.log(`Synced ${src} → ${dest}`);
}

async function fromGithubRelease() {
  const tmp = path.join(root, ".tmp-lsemods-data");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const zip = path.join(tmp, "main.zip");
  console.log("Downloading lyon-9498/LSEMods main…");
  execFileSync(
    "curl",
    ["-fsSL", "-o", zip, "https://codeload.github.com/lyon-9498/LSEMods/zip/refs/heads/main"],
    { stdio: "inherit" },
  );
  execFileSync("unzip", ["-q", zip, "-d", tmp], { stdio: "inherit" });
  const extracted = path.join(tmp, "LSEMods-main");
  const candidates = [
    path.join(extracted, "public", "data"),
    path.join(extracted, "data"),
    path.join(extracted, "dist", "data"),
  ];
  let src = null;
  for (const c of candidates) {
    if (await exists(path.join(c, "index.json"))) {
      src = c;
      break;
    }
  }
  if (!src) {
    console.error("Could not find data/index.json in the downloaded repo");
    process.exit(1);
  }
  await copyTree(src);
  await rm(tmp, { recursive: true, force: true });
}

if (fromGithub) {
  await fromGithubRelease();
} else if (srcArg) {
  await copyTree(path.resolve(srcArg));
} else {
  console.log(`Usage:
  npm run data:sync -- /path/to/LSEMods/public/data
  npm run data:sync -- --from-github

Current data stays at ${dest}`);
  process.exit(srcArg || fromGithub ? 1 : 0);
}
