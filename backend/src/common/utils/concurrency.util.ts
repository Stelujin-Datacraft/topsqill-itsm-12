/**
 * Run async work over items with a fixed concurrency pool.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;

  const queue = [...items];
  const poolSize = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: poolSize }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) {
          await worker(item);
        }
      }
    }),
  );
}
