import { listModules } from './registry/promotable-registry';
import type { PromotionModule } from './registry/types';

export type PackageModulesInput = {
  module?: string;
  modules?: string[] | string;
};

/**
 * Normalize create/list inputs into a unique ordered list of valid modules
 * and a display label for the legacy `module` column.
 */
export function normalizePackageModules(input: PackageModulesInput): {
  modules: PromotionModule[];
  moduleLabel: string;
} {
  const allowed = new Set(listModules().map((m) => m.module));
  const raw: string[] = [];

  if (Array.isArray(input.modules)) {
    for (const m of input.modules) {
      if (m != null && String(m).trim()) raw.push(String(m).trim());
    }
  } else if (typeof input.modules === 'string' && input.modules.trim()) {
    for (const part of input.modules.split(',')) {
      if (part.trim()) raw.push(part.trim());
    }
  }

  if (!raw.length && input.module?.trim()) {
    raw.push(input.module.trim());
  }

  const modules: PromotionModule[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (!allowed.has(m as PromotionModule)) continue;
    if (seen.has(m)) continue;
    seen.add(m);
    modules.push(m as PromotionModule);
  }

  if (!modules.length) {
    throw new Error('Select at least one valid promotable module');
  }

  const moduleLabel = modules.length === 1 ? modules[0] : modules.join(' + ');
  return { modules, moduleLabel };
}

export function parseModulesQuery(module?: string, modules?: string): PromotionModule[] | null {
  if (!module?.trim() && !modules?.trim()) return null;
  return normalizePackageModules({ module, modules }).modules;
}
