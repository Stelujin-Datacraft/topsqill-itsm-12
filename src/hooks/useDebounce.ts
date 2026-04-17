import { useState, useEffect } from 'react';

/**
 * Debounce a fast-changing value (e.g., search input).
 * Returns the value only after `delay` ms of no changes.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
