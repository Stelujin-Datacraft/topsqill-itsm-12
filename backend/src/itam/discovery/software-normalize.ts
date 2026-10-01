/**
 * Software name normalization — deterministic catalog + aliases.
 * AI may suggest aliases offline; runtime uses catalog only.
 */
import { randomUUID } from 'crypto';
import type { DiscoveryStore } from './store';

const BUILTIN_ALIASES: Array<{ canonical: string; publisher?: string; aliases: string[] }> = [
  {
    canonical: 'Microsoft Office',
    publisher: 'Microsoft',
    aliases: ['microsoft office', 'ms office', 'microsoft office 365', 'office 365', 'microsoft 365 apps'],
  },
  {
    canonical: 'Google Chrome',
    publisher: 'Google',
    aliases: ['google chrome', 'chrome', 'chromium'],
  },
  {
    canonical: 'Microsoft Edge',
    publisher: 'Microsoft',
    aliases: ['microsoft edge', 'edge'],
  },
];

export function normalizeSoftwareKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function ensureBuiltinCatalog(store: DiscoveryStore, organizationId?: string) {
  for (const item of BUILTIN_ALIASES) {
    let product = store.catalog.find(
      (c) => c.canonicalName === item.canonical && (c.organizationId === organizationId || !c.organizationId),
    );
    if (!product) {
      product = {
        id: randomUUID(),
        organizationId,
        canonicalName: item.canonical,
        publisher: item.publisher,
      };
      store.catalog.push(product);
    }
    for (const alias of item.aliases) {
      if (!store.aliases.some((a) => a.productId === product!.id && a.aliasName === alias)) {
        store.aliases.push({ id: randomUUID(), productId: product.id, aliasName: alias });
      }
    }
  }
}

export function resolveSoftwareProduct(
  store: DiscoveryStore,
  rawName: string,
  organizationId?: string,
): { productId?: string; canonicalName: string; publisher?: string } {
  ensureBuiltinCatalog(store, organizationId);
  const key = normalizeSoftwareKey(rawName);
  const alias = store.aliases.find((a) => a.aliasName === key);
  if (alias) {
    const product = store.catalog.find((c) => c.id === alias.productId);
    if (product) {
      return { productId: product.id, canonicalName: product.canonicalName, publisher: product.publisher };
    }
  }
  const direct = store.catalog.find((c) => normalizeSoftwareKey(c.canonicalName) === key);
  if (direct) {
    return { productId: direct.id, canonicalName: direct.canonicalName, publisher: direct.publisher };
  }
  return { canonicalName: rawName.trim() };
}
