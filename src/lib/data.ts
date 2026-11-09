import { readFile } from "fs/promises";
import path from "path";
import type { IndexEntry, Meta } from "./types";

const dataRoot = path.join(process.cwd(), "public", "data");

async function readJson<T>(rel: string): Promise<T> {
  const raw = await readFile(path.join(dataRoot, rel), "utf8");
  return JSON.parse(raw) as T;
}

export async function getIndex(): Promise<IndexEntry[]> {
  return readJson<IndexEntry[]>("index.json");
}

export async function getMeta(): Promise<Meta> {
  return readJson<Meta>("meta.json");
}

export async function getCourseCodes(): Promise<string[]> {
  const index = await getIndex();
  return index.map((c) => c.code);
}
