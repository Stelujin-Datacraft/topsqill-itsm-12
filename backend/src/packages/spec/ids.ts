// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.
import type { FormData, PackageFile, PackageObject, ReportData, SolutionData, WorkflowData } from './types';

export const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Keys whose values point at a form, wherever they appear in field, node or component config. */
export const FORM_REFERENCE_KEYS = [
  'form_id',
  'formId',
  'source_form_id',
  'sourceFormId',
  'target_form_id',
  'targetFormId',
  'primaryFormId',
  'secondaryFormId',
  'lookupFormId',
];

/** Every row id the package owns. These are replaced with fresh ids when it is installed. */
export function collectSourceIds(pkg: Pick<PackageFile, 'objects'>): string[] {
  const ids = new Set<string>();
  const add = (row: { id?: unknown } | undefined) => {
    if (row && typeof row.id === 'string') ids.add(row.id.toLowerCase());
  };
  for (const object of pkg.objects) {
    if (object.type === 'solution') add((object.data as unknown as SolutionData).solution);
    if (object.type === 'form') {
      const data = object.data as unknown as FormData;
      add(data.form);
      data.fields?.forEach(add);
    }
    if (object.type === 'workflow') {
      const data = object.data as unknown as WorkflowData;
      add(data.workflow);
      data.nodes?.forEach(add);
      data.connections?.forEach(add);
      data.triggers?.forEach(add);
    }
    if (object.type === 'report') {
      const data = object.data as unknown as ReportData;
      add(data.report);
      data.components?.forEach(add);
    }
  }
  return [...ids];
}

/**
 * Replaces every mapped UUID anywhere in the value, including inside strings such as
 * query-field SQL or formulas. UUIDs are globally unique, so a whole-token swap is safe.
 */
export function remapIds<T>(value: T, idMap: Record<string, string>): T {
  const lookup = new Map(Object.entries(idMap).map(([from, to]) => [from.toLowerCase(), to]));
  const visit = (node: unknown): unknown => {
    if (typeof node === 'string') return node.replace(UUID_PATTERN, (match) => lookup.get(match.toLowerCase()) ?? match);
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) out[key] = visit(child);
      return out;
    }
    return node;
  };
  return visit(value) as T;
}

/** Form ids referenced by the package's config that are not part of the package. */
export function externalFormReferences(pkg: Pick<PackageFile, 'objects'>): { objectKey: string; formId: string }[] {
  const included = new Set(
    pkg.objects.filter((o) => o.type === 'form').map((o) => String((o.data as unknown as FormData).form.id).toLowerCase()),
  );
  const found: { objectKey: string; formId: string }[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown, objectKey: string) => {
    if (Array.isArray(node)) return node.forEach((child) => visit(child, objectKey));
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (FORM_REFERENCE_KEYS.includes(key) && typeof child === 'string' && /^[0-9a-f-]{36}$/i.test(child)) {
        const id = child.toLowerCase();
        const marker = `${objectKey}|${id}`;
        if (!included.has(id) && !seen.has(marker)) {
          seen.add(marker);
          found.push({ objectKey, formId: id });
        }
      } else {
        visit(child, objectKey);
      }
    }
  };
  for (const object of pkg.objects) visit(object.data, object.key);
  return found;
}

export function objectKey(type: PackageObject['type'], sourceId: string): string {
  return `${type}:${sourceId.toLowerCase()}`;
}
