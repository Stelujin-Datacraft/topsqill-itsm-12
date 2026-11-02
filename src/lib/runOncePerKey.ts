/**
 * Shares one run of `task` per key for the life of the page. Callers that arrive
 * while it is running wait for the same result. A run that reports `retry: true`
 * (or throws) is forgotten, so the next caller tries again.
 */
export function createRunOncePerKey<T>() {
  const runs = new Map<string, Promise<T>>();

  return function runOncePerKey(key: string, task: () => Promise<{ value: T; retry?: boolean }>): Promise<T> {
    const existing = runs.get(key);
    if (existing) return existing;
    const run = task().then(
      ({ value, retry }) => {
        if (retry) runs.delete(key);
        return value;
      },
      (error) => {
        runs.delete(key);
        throw error;
      },
    );
    runs.set(key, run);
    return run;
  };
}
