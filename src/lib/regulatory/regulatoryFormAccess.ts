import { CLAUSE_REGISTER_FORM_NAME, CLAUSE_REGISTER_REFERENCE_ID } from '@/lib/regulatory/clauseRegisterForm';
import { REQUIREMENT_REGISTER_FORM_NAME, REQUIREMENT_REGISTER_REFERENCE_ID } from '@/lib/regulatory/requirementRegisterForm';
import { STANDARD_LIBRARY_FORM_NAME, STANDARD_LIBRARY_REFERENCE_ID } from '@/lib/regulatory/standardLibraryForm';

/** Project members who can open the form may add records. Edit stays with administrators. */
export const REGULATORY_FORM_PERMISSIONS = {
  view: ['*'],
  submit: ['*'],
  edit: ['admin'],
};

export function regulatoryFormPermissionsJson(): string {
  return JSON.stringify(REGULATORY_FORM_PERMISSIONS);
}

export const REGULATORY_REGISTERS = [
  { referenceId: STANDARD_LIBRARY_REFERENCE_ID, name: STANDARD_LIBRARY_FORM_NAME },
  { referenceId: CLAUSE_REGISTER_REFERENCE_ID, name: CLAUSE_REGISTER_FORM_NAME },
  { referenceId: REQUIREMENT_REGISTER_REFERENCE_ID, name: REQUIREMENT_REGISTER_FORM_NAME },
] as const;

export function isRegulatoryRegisterReference(referenceId: unknown): boolean {
  return REGULATORY_REGISTERS.some((entry) => entry.referenceId === referenceId);
}

export function regulatoryRegisterSortIndex(referenceId: unknown): number {
  const index = REGULATORY_REGISTERS.findIndex((entry) => entry.referenceId === referenceId);
  return index === -1 ? REGULATORY_REGISTERS.length : index;
}

export function permissionsAllowProjectFill(raw: unknown): boolean {
  const parsed = parsePermissions(raw);
  const view = parsed.view;
  const submit = parsed.submit;
  return (Array.isArray(view) && view.includes('*'))
    || (Array.isArray(submit) && submit.includes('*'));
}

export function canSeeLoadedForm(
  form: {
    id: string;
    is_public?: boolean | null;
    created_by?: string | null;
    reference_id?: string | null;
  },
  access: {
    userId: string;
    readableFormIds: { has: (id: string) => boolean };
    isProjectMember: boolean;
    hasRoleAssignments: boolean;
  },
): boolean {
  if (isRegulatoryRegisterReference(form.reference_id)) return true;
  if (form.is_public) return true;
  if (form.created_by && form.created_by === access.userId) return true;
  if (access.readableFormIds.has(form.id)) return true;
  if (access.isProjectMember && !access.hasRoleAssignments) return true;
  return false;
}

export async function ensureRegulatoryFormFillAccess(
  client: { from: (table: string) => any },
  formId: string,
  currentPermissions: unknown,
): Promise<void> {
  if (permissionsAllowProjectFill(currentPermissions)) return;
  const { error } = await client.from('forms').update({
    permissions: regulatoryFormPermissionsJson(),
  }).eq('id', formId);
  if (error) {
    throw new Error(error.message || 'Failed to open the regulatory form for this project');
  }
}

function parsePermissions(raw: unknown): { view?: unknown; submit?: unknown } {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as { view?: unknown; submit?: unknown };
  return {};
}
