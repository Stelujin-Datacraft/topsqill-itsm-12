/**
 * Storage utilities for localStorage optimization
 * - Debounced writes to reduce I/O operations
 * - Automatic cleanup of stale drafts
 */

const DRAFT_EXPIRY_DAYS = 7;

// Debounce timers map
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Debounced localStorage write - prevents excessive writes during rapid changes
 * @param key - Storage key
 * @param data - Data to store
 * @param delay - Debounce delay in ms (default: 2000ms)
 */
export function debouncedStorageWrite(key: string, data: any, delay: number = 2000): void {
  // Clear existing timer for this key
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      debounceTimers.delete(key);
    } catch (error) {
      console.error('❌ Debounced storage write failed:', key, error);
    }
  }, delay);

  debounceTimers.set(key, timer);
}

/**
 * Immediately flush a pending debounced write
 * Useful when user navigates away or saves
 */
export function flushStorageWrite(key: string, data: any): void {
  // Clear any pending timer
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
    debounceTimers.delete(key);
  }

  // Write immediately
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('❌ Storage flush failed:', key, error);
  }
}

/**
 * Clean up stale drafts older than specified days
 * Should be called once on app initialization
 */
export function cleanupStaleDrafts(): void {
  try {
    const now = Date.now();
    const expiryMs = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const keysToRemove: string[] = [];

    // Scan localStorage for draft keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Only process form drafts
      if (key.startsWith('form-draft-')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const { timestamp } = JSON.parse(stored);
            if (timestamp) {
              const draftAge = now - new Date(timestamp).getTime();
              if (draftAge > expiryMs) {
                keysToRemove.push(key);
              }
            }
          }
        } catch {
          // If we can't parse it, it's likely corrupted - remove it
          keysToRemove.push(key);
        }
      }
    }

    // Remove stale drafts
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleaned up stale draft:', key);
    });

    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleanup complete: removed ${keysToRemove.length} stale draft(s)`);
    }
  } catch (error) {
    console.error('❌ Draft cleanup failed:', error);
  }
}

/**
 * Get storage usage stats for debugging
 */
export function getStorageStats(): { used: number; drafts: number; draftKeys: string[] } {
  let used = 0;
  let drafts = 0;
  const draftKeys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
          if (key.startsWith('form-draft-')) {
            drafts++;
            draftKeys.push(key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to get storage stats:', error);
  }

  return { used, drafts, draftKeys };
}
