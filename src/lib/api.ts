import { isValidCourseCode, pLimit } from "./async";
import { canonicalCode } from "./courseAliases";
import type { Course, IndexEntry, Meta } from "./types";

const limit = pLimit(5);
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string, { cacheFailures = false } = {}): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;

  const promise = limit(async () => {
    const r = await fetch(`/data/${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json() as Promise<T>;
  }).catch((err) => {
    if (!cacheFailures) cache.delete(path);
    throw err;
  });

  cache.set(path, promise);
  return promise;
}

export const loadIndex = () => getJson<IndexEntry[]>("index.json", { cacheFailures: true });
export const loadMeta = () => getJson<Meta>("meta.json", { cacheFailures: true });

export function loadCourse(code: string): Promise<Course> {
  const normalized = canonicalCode(code);
  if (!isValidCourseCode(normalized)) {
    return Promise.reject(new Error(`Invalid course code: ${code}`));
  }
  return getJson<Course>(`courses/${normalized}.json`);
}
