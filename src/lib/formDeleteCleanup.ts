/**
 * Ordered child cleanup before deleting a forms row.
 * Dev (and any DB without ON DELETE CASCADE on form_fields) fails with
 * form_fields_form_id_fkey if fields still reference the form.
 *
 * Does NOT delete form_submissions (business records — retention decision).
 * Audit logs should SET NULL / CASCADE at DB level; we do not wipe them here.
 */

export type FormDeleteClient = {
  from: (table: string) => {
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<{
        data?: unknown;
        error: { message: string } | null;
      }>;
    };
  };
};

const CHILD_TABLES = [
  'form_fields',
  'form_user_access',
  'form_access_requests',
] as const;

export async function deleteFormChildRows(
  client: FormDeleteClient,
  formId: string,
): Promise<void> {
  for (const table of CHILD_TABLES) {
    const { error } = await client.from(table).delete().eq('form_id', formId);
    // Missing table on some envs should not block; only surface real SQL/RLS errors.
    if (error) {
      const msg = error.message || '';
      if (/does not exist|schema cache|Could not find the table/i.test(msg)) {
        continue;
      }
      throw error;
    }
  }
}

export function formatFormDeleteError(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? 'Unknown error');

  if (/form_fields_form_id_fkey|foreign key/i.test(message)) {
    return 'Cannot delete this form while related records still reference it. Remove fields (and submissions, if present) first, or apply the Dev FK repair migration.';
  }
  if (/row-level security|permission denied|violates row-level/i.test(message)) {
    return 'Delete blocked by security policy. Confirm Dev RLS helpers/policies are applied (see docs/dev-schema-repair).';
  }
  if (/No rows (were )?deleted|zero rows/i.test(message)) {
    return 'Delete did not remove any form. You may lack permission, or the form was already deleted.';
  }
  return message;
}
