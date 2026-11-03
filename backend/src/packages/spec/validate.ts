// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.
import { externalFormReferences } from './ids';
import { isValidVersion } from './semver';
import {
  KNOWN_MODULES,
  PACKAGE_FORMAT,
  PACKAGE_FORMAT_VERSION,
  PACKAGE_LICENSES,
  PACKAGE_OBJECT_TYPES,
  type FormData,
  type PackageFile,
  type SolutionData,
} from './types';

export const PACKAGE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateManifest(manifest: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(manifest)) return ['manifest is missing'];
  if (typeof manifest.key !== 'string' || !PACKAGE_KEY_PATTERN.test(manifest.key)) {
    errors.push('manifest.key must be lowercase letters, numbers and dashes (2-63 characters), starting with a letter');
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) errors.push('manifest.name is required');
  if (typeof manifest.version !== 'string' || !isValidVersion(manifest.version)) {
    errors.push('manifest.version must be a semantic version such as 1.0.0');
  }
  if (typeof manifest.publisher !== 'string' || !manifest.publisher.trim()) errors.push('manifest.publisher is required');
  if (!(PACKAGE_LICENSES as readonly unknown[]).includes(manifest.license)) {
    errors.push(`manifest.license must be one of ${PACKAGE_LICENSES.join(', ')}`);
  }
  const requires = manifest.requires as Record<string, unknown> | undefined;
  if (!isObject(requires) || !Array.isArray(requires.modules)) {
    errors.push('manifest.requires.modules must be a list');
  } else {
    for (const module of requires.modules) {
      if (!(KNOWN_MODULES as readonly unknown[]).includes(module)) errors.push(`manifest.requires.modules has unknown module "${String(module)}"`);
    }
  }
  return errors;
}

/** Structural checks only; integrity and signature are checked by verifyIntegrity(). */
export function validatePackage(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ['Not a package file'], warnings };
  if (input.format !== PACKAGE_FORMAT) errors.push(`format must be "${PACKAGE_FORMAT}"`);
  if (input.formatVersion !== PACKAGE_FORMAT_VERSION) errors.push(`formatVersion ${String(input.formatVersion)} is not supported (expected ${PACKAGE_FORMAT_VERSION})`);
  errors.push(...validateManifest(input.manifest));

  if (!Array.isArray(input.objects)) {
    errors.push('objects must be a list');
    return { ok: false, errors, warnings };
  }

  const keys = new Set<string>();
  const formIds = new Set<string>();
  let solutions = 0;
  input.objects.forEach((object: unknown, index: number) => {
    const where = `objects[${index}]`;
    if (!isObject(object)) {
      errors.push(`${where} is not an object`);
      return;
    }
    if (!(PACKAGE_OBJECT_TYPES as readonly unknown[]).includes(object.type)) errors.push(`${where}.type "${String(object.type)}" is not supported`);
    if (typeof object.key !== 'string' || !object.key.startsWith(`${String(object.type)}:`)) {
      errors.push(`${where}.key must start with "${String(object.type)}:"`);
    } else if (keys.has(object.key)) {
      errors.push(`${where}.key "${object.key}" appears more than once`);
    } else {
      keys.add(object.key);
    }
    if (!isObject(object.data)) {
      errors.push(`${where}.data is missing`);
      return;
    }
    if (object.type === 'solution') {
      solutions++;
      const data = object.data as unknown as SolutionData;
      if (!isObject(data.solution) || typeof data.solution.name !== 'string') errors.push(`${where}.data.solution is missing`);
      if (!Array.isArray(data.formIds)) errors.push(`${where}.data.formIds must be a list`);
    }
    if (object.type === 'form') {
      const data = object.data as unknown as FormData;
      if (!isObject(data.form) || typeof data.form.id !== 'string') errors.push(`${where}.data.form is missing`);
      else formIds.add(data.form.id.toLowerCase());
      if (!Array.isArray(data.fields)) errors.push(`${where}.data.fields must be a list`);
    }
    if (object.type === 'workflow') {
      const data = object.data as Record<string, unknown>;
      if (!isObject(data.workflow)) errors.push(`${where}.data.workflow is missing`);
      for (const list of ['nodes', 'connections', 'triggers']) if (!Array.isArray(data[list])) errors.push(`${where}.data.${list} must be a list`);
    }
    if (object.type === 'report') {
      const data = object.data as Record<string, unknown>;
      if (!isObject(data.report)) errors.push(`${where}.data.report is missing`);
      if (!Array.isArray(data.components)) errors.push(`${where}.data.components must be a list`);
    }
  });

  if (solutions !== 1) errors.push(`A package must contain exactly one solution (found ${solutions})`);
  const solution = input.objects.find((o: unknown) => isObject(o) && o.type === 'solution') as { data?: SolutionData } | undefined;
  for (const id of solution?.data?.formIds || []) {
    if (!formIds.has(String(id).toLowerCase())) errors.push(`The solution lists form ${id}, which is not in the package`);
  }

  if (!errors.length) {
    for (const ref of externalFormReferences(input as unknown as PackageFile)) {
      warnings.push(`${ref.objectKey} refers to form ${ref.formId}, which is not in the package`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
