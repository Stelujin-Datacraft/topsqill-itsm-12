export const PACKAGE_LICENSE_OPTIONS = [
  { value: 'private', label: 'Private (only organisations you assign)' },
  { value: 'free', label: 'Free (any organisation can install)' },
  { value: 'paid', label: 'Paid (needs a plan or add-on)' },
] as const;

export type PackageLicenseOption = (typeof PACKAGE_LICENSE_OPTIONS)[number]['value'];

/** "Asset Management (v2)" -> "asset-management-v2"; always a valid package key. */
export function packageKeyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
  if (!slug) return 'package';
  return /^[a-z]/.test(slug) ? (slug.length >= 2 ? slug : `${slug}-package`) : `p-${slug}`.slice(0, 63);
}

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const KEY = /^[a-z][a-z0-9-]{1,62}$/;

export interface ExportFormValues {
  key: string;
  name: string;
  version: string;
  description: string;
  license: PackageLicenseOption;
  requiresModules: string[];
}

export function exportFormErrors(values: ExportFormValues): Partial<Record<keyof ExportFormValues, string>> {
  const errors: Partial<Record<keyof ExportFormValues, string>> = {};
  if (!values.name.trim()) errors.name = 'Enter a package name';
  if (!KEY.test(values.key)) errors.key = 'Use lowercase letters, numbers and dashes, starting with a letter';
  if (!VERSION.test(values.version.trim())) errors.version = 'Use a version like 1.0.0';
  return errors;
}

export function downloadJson(fileName: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
