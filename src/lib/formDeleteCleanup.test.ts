/**
 * Form delete cleanup helpers.
 * Run: npx tsx src/lib/formDeleteCleanup.test.ts
 */
import assert from 'assert';
import {
  deleteFormChildRows,
  formatFormDeleteError,
  type FormDeleteClient,
} from './formDeleteCleanup';

function makeClient(opts: {
  failTable?: string;
  failMessage?: string;
  missingTable?: string;
}) {
  const deleted: string[] = [];
  const client: FormDeleteClient = {
    from(table: string) {
      return {
        delete: () => ({
          eq: async () => {
            deleted.push(table);
            if (opts.missingTable === table) {
              return { data: null, error: { message: 'Could not find the table' } };
            }
            if (opts.failTable === table) {
              return {
                data: null,
                error: { message: opts.failMessage || 'row-level security policy' },
              };
            }
            return { data: [], error: null };
          },
        }),
      };
    },
  };
  return { client, deleted };
}

async function main() {
  console.log('formDeleteCleanup');

  {
    const { client, deleted } = makeClient({});
    await deleteFormChildRows(client, 'form-1');
    assert.deepEqual(deleted, [
      'form_fields',
      'form_user_access',
      'form_access_requests',
    ]);
    console.log('  ✓ deletes children in order');
  }

  {
    const { client } = makeClient({
      failTable: 'form_fields',
      failMessage: 'new row violates row-level security policy',
    });
    let threw = false;
    try {
      await deleteFormChildRows(client, 'form-1');
    } catch (e: any) {
      threw = /row-level security/i.test(String(e?.message || e));
    }
    assert.equal(threw, true);
    console.log('  ✓ surfaces child RLS/SQL errors');
  }

  {
    const { client, deleted } = makeClient({ missingTable: 'form_access_requests' });
    await deleteFormChildRows(client, 'form-1');
    assert.deepEqual(deleted, [
      'form_fields',
      'form_user_access',
      'form_access_requests',
    ]);
    console.log('  ✓ skips missing child tables');
  }

  {
    assert.match(
      formatFormDeleteError({
        message: 'violates foreign key constraint form_fields_form_id_fkey',
      }),
      /related records/i,
    );
    assert.match(
      formatFormDeleteError({ message: 'new row violates row-level security policy' }),
      /security policy/i,
    );
    assert.match(
      formatFormDeleteError({ message: 'No rows were deleted' }),
      /did not remove/i,
    );
    console.log('  ✓ formats FK / RLS / zero-row errors');
  }

  console.log('formDeleteCleanup: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
