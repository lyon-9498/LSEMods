/** Trailing-edge debounce. */
export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
  };
  return wrapped;
}

/** Leading + trailing throttle. */
export function throttle<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let last = 0;
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (t) clearTimeout(t);
      t = undefined;
      last = now;
      fn(...args);
    } else if (!t) {
      t = setTimeout(() => {
        last = Date.now();
        t = undefined;
        fn(...args);
      }, remaining);
    }
  };
}

/** Limit concurrent async work. */
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

export const CODE_RE = /^[A-Z][A-Z0-9]{2,9}$/i;

export function isValidCourseCode(code: string): boolean {
  return CODE_RE.test(code.trim());
}
