/**
 * Guards against user_sessions updates with a missing UUID filter value.
 *
 *   npx tsx test/database/user-sessions-uuid-guard.test.ts
 */
import assert from 'assert';
import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  assertFiltersHaveValues,
  unwrapNestQueryPayload,
} from '../../../src/utils/databaseQueryGuards';
import {
  isSessionUuid,
  normalizeUserSessionRow,
} from '../../../src/utils/userSessionRow';

function section(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    console.error(`  ✗ ${name}:`, e?.message || e);
    throw e;
  }
}

function main() {
  console.log('user_sessions UUID filter guard');

  section('JSON.stringify drops undefined filter values (repro)', () => {
    const filters = [{ kind: 'filter' as const, column: 'id', operator: 'eq', value: undefined }];
    const body = JSON.stringify({
      table: 'user_sessions',
      data: { last_activity: new Date().toISOString() },
      filters,
    });
    assert.equal(body.includes('"value"'), false, 'undefined value must be omitted by JSON.stringify');
    assert.match(body, /"column":"id"/);
  });

  section('assertFiltersHaveValues rejects missing id', () => {
    const expectBlocked = (value: unknown) => {
      let blocked = false;
      try {
        assertFiltersHaveValues([{ kind: 'filter', column: 'id', operator: 'eq', value }]);
      } catch (e: any) {
        blocked = /filter value is required/i.test(String(e?.message || e));
      }
      assert.equal(blocked, true, `expected block for value=${String(value)}`);
    };
    expectBlocked(undefined);
    expectBlocked('undefined');
    assertFiltersHaveValues([
      { kind: 'filter', column: 'id', operator: 'eq', value: 'be8e848b-43d9-40c9-8cd0-de4f6ddb9b19' },
    ]);
  });

  section('unwrapNestQueryPayload flattens nested envelopes / maybeSingle arrays', () => {
    const id = '5c8da8c7-251b-4637-8b52-793993a46264';
    const row = { id, is_active: true, session_token: 'tok' };

    assert.deepEqual(
      unwrapNestQueryPayload({ data: row, error: null }),
      row,
    );
    assert.deepEqual(
      unwrapNestQueryPayload({ data: { data: row, error: null }, error: null }),
      row,
    );
    assert.equal(
      (unwrapNestQueryPayload({ data: [row], error: null }, { maybeSingle: true }) as any).id,
      id,
    );
    // Truthy nested object without top-level id (would previously call .eq('id', undefined))
    const nestedOnly = { data: row, error: null };
    assert.equal((nestedOnly as any).id, undefined);
    assert.equal(
      (unwrapNestQueryPayload(nestedOnly, { maybeSingle: true }) as any).id,
      id,
    );
  });

  section('normalizeUserSessionRow requires UUID id', () => {
    const id = 'be8e848b-43d9-40c9-8cd0-de4f6ddb9b19';
    assert.equal(isSessionUuid(id), true);
    assert.equal(isSessionUuid('undefined'), false);
    assert.equal(isSessionUuid(undefined), false);

    assert.equal(normalizeUserSessionRow(null), null);
    assert.equal(normalizeUserSessionRow({ is_active: true }), null);
    assert.equal(
      normalizeUserSessionRow({ data: { id, is_active: false } })?.id,
      id,
    );
    assert.equal(
      normalizeUserSessionRow({ data: { id, is_active: false } })?.is_active,
      false,
    );
    assert.equal(
      normalizeUserSessionRow([{ id, is_active: true }])?.id,
      id,
    );
  });

  section('DatabaseService rejects filters without value', () => {
    const svc = new DatabaseService({} as any);
    assert.throws(
      () =>
        svc.assertFilterValues([
          { kind: 'filter', column: 'id', operator: 'eq', value: undefined },
        ]),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.throws(
      () =>
        svc.assertFilterValues([
          { kind: 'filter', column: 'id', operator: 'eq' } as any,
        ]),
      BadRequestException,
    );
    svc.assertFilterValues([
      { kind: 'filter', column: 'id', operator: 'eq', value: 'be8e848b-43d9-40c9-8cd0-de4f6ddb9b19' },
    ]);
  });

  console.log('\nAll user_sessions UUID filter guard tests passed.');
}

main();
