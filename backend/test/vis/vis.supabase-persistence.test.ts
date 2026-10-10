/**
 * VIS Supabase persistence tests. Uses a mocked Supabase client — no Dev or Prod network calls.
 * Run: npx tsx test/vis/vis.supabase-persistence.test.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { LocalEncryptedSecretProvider } from '../../src/vis/security/secret-provider';
import { setVisSupabaseClientForTests } from '../../src/vis/store/supabase-vis.client';
import { SupabaseVisStore, VisPersistenceError } from '../../src/vis/store/supabase-vis.store';
import {
  clearVisStoreForTests,
  getVisStore,
  resetVisStoreForTests,
  resetVisStoreSupabaseForTests,
  VisStore,
} from '../../src/vis/store/vis.store';
import { SupabaseModule } from '../../src/supabase/supabase.module';
import { VisEnterpriseService } from '../../src/vis/enterprise/vis-enterprise.service';
import { VisService } from '../../src/vis/integrations/vis.service';
import { VisPersistenceService } from '../../src/vis/store/vis-persistence.service';
import { createMockSupabase } from './mock-supabase-client';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
  ],
  providers: [VisService, VisEnterpriseService, VisPersistenceService],
})
class VisBootModule {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  setVisSupabaseClientForTests(null);
}

function useSupabaseTestEnv() {
  delete process.env.VIS_DATABASE_URL;
  delete process.env.VIS_STORE_MEMORY;
  delete process.env.VIS_ALLOW_FILE_STORE;
  process.env.NODE_ENV = 'test';
  process.env.VIS_PERSISTENCE = 'supabase';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.VIS_SECRET_MASTER_KEY = 'supabase-persistence-test-key';
}

async function testCrudFilterAndErrors() {
  useSupabaseTestEnv();
  const mock = createMockSupabase();
  setVisSupabaseClientForTests(mock.client);
  const store = await resetVisStoreSupabaseForTests();
  assert(store.isSupabaseBacked, 'store is supabase backed');
  assert(!('VIS_DATABASE_URL' in process.env) || !process.env.VIS_DATABASE_URL, 'VIS_DATABASE_URL absent');

  const created = store.create('integrations', {
    name: 'Beta',
    status: 'DRAFT',
    environment: 'DEV',
    description: 'first',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });
  store.create('integrations', {
    name: 'Alpha',
    status: 'ACTIVE',
    environment: 'DEV',
    description: 'second',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  store.create('integrations', {
    name: 'Gamma',
    status: 'DRAFT',
    environment: 'TEST',
    description: 'third',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  });
  await store.flushDurable();

  assert(store.get('integrations', created.id)?.name === 'Beta', 'read created integration');
  const updated = store.update('integrations', created.id, { status: 'ACTIVE', description: 'renamed' });
  assert(updated?.status === 'ACTIVE', 'update returned');
  await store.flushDurable();
  assert(store.get('integrations', created.id)?.description === 'renamed', 'update visible');

  const durable = new SupabaseVisStore(mock.client);
  const drafts = await durable.listAsync('integrations', {
    filters: { status: 'DRAFT' },
    orderBy: { column: 'name', ascending: true },
  });
  assert(drafts.length === 1 && drafts[0].name === 'Gamma', 'filter status DRAFT');

  const page = await durable.listAsync('integrations', {
    orderBy: { column: 'name', ascending: true },
    limit: 1,
    offset: 1,
  });
  assert(page.length === 1 && page[0].name === 'Beta', 'sort and paginate');

  const descending = await durable.listAsync('integrations', {
    orderBy: { column: 'name', ascending: false },
    limit: 1,
  });
  assert(descending[0].name === 'Gamma', 'descending sort');

  assert(store.remove('integrations', created.id), 'delete');
  await store.flushDurable();
  assert(store.get('integrations', created.id) == null, 'deleted from cache');
  const reloaded = await resetVisStoreSupabaseForTests();
  assert(reloaded.get('integrations', created.id) == null, 'delete survived hydrate');
  assert(reloaded.list('integrations').some((row) => row.name === 'Alpha'), 'other rows hydrated');

  const version = durable.createAsync.bind(durable);
  const orphan = await version('versions', {
    id: 'version-orphan',
    integrationId: 'missing-integration',
    version: 1,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
  }).then(() => null, (error) => error);
  assert(orphan instanceof VisPersistenceError, 'fk failure is a persistence error');
  assert(/23503|foreign key/i.test(orphan.message), 'foreign key surfaced');

  const parent = reloaded.get('integrations', reloaded.list('integrations')[0].id)!;
  await durable.createAsync('versions', {
    id: 'version-1',
    integrationId: parent.id,
    version: 1,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
  });
  const duplicate = await durable.createAsync('versions', {
    id: 'version-1b',
    integrationId: parent.id,
    version: 1,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
  }).then(() => null, (error) => error);
  assert(duplicate instanceof VisPersistenceError, 'unique failure is a persistence error');
  assert(/23505|duplicate key/i.test(duplicate.message), 'unique constraint surfaced');

  mock.failNext('vis_integrations', 'insert', { message: 'permission denied', code: '42501' });
  const rejectedId = reloaded.create('integrations', {
    name: 'Should Not Persist',
    status: 'DRAFT',
    environment: 'DEV',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).id;
  let flushFailed = false;
  let flushError = '';
  try {
    await reloaded.flushDurable();
  } catch (error) {
    flushError = error instanceof Error ? error.message : String(error);
    flushFailed = /permission denied/.test(flushError);
  }
  assert(flushFailed, `flushDurable rejects supabase errors (${flushError || 'no error'})`);
  assert(reloaded.get('integrations', rejectedId) == null, 'failed create is not kept in memory');
  assert(reloaded.isSupabaseBacked, 'error does not switch persistence mode');
  const afterError = await resetVisStoreSupabaseForTests();
  assert(!afterError.list('integrations').some((row) => row.name === 'Should Not Persist'), 'failed row was not stored');
}

async function testDocumentsAndTransaction() {
  useSupabaseTestEnv();
  const mock = createMockSupabase();
  setVisSupabaseClientForTests(mock.client);
  const store = await resetVisStoreSupabaseForTests();
  const form = store.create('mockForms', {
    id: 'form-custom',
    name: 'Custom',
    fields: [{ name: 'title', type: 'text' }],
  });
  await store.flushDurable();
  store.update('mockForms', form.id, { name: 'Custom Updated' });
  await store.flushDurable();
  const forms = await new SupabaseVisStore(mock.client).listAsync('mockForms', {
    filters: { name: 'Custom Updated' },
  });
  assert(forms.length === 1, 'document filter');
  assert(store.remove('mockForms', form.id), 'document delete');
  await store.flushDurable();
  assert(store.get('mockForms', form.id) == null, 'document removed');

  const txStore = getVisStore();
  const result = await txStore.transaction(async (tx) => {
    const integration = tx.create('integrations', {
      id: 'tx-integration',
      name: 'Transactional',
      status: 'DRAFT',
      environment: 'DEV',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const version = tx.create('versions', {
      id: 'tx-version',
      integrationId: integration.id,
      version: 1,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    });
    assert(tx.get('integrations', integration.id)?.name === 'Transactional', 'transaction get sees create');
    return version.id;
  });
  assert(result === 'tx-version', 'transaction result');
  assert(mock.rows('vis_integrations').some((row) => row.id === 'tx-integration'), 'transaction wrote integration');
  assert(mock.rows('vis_integration_versions').some((row) => row.id === 'tx-version'), 'transaction wrote version');

  mock.setRpc(() => ({ data: null, error: { message: 'transaction aborted', code: '40001' } }));
  let rolledBack = false;
  try {
    await txStore.transaction(async (tx) => {
      tx.create('integrations', {
        id: 'tx-rollback',
        name: 'Rollback',
        status: 'DRAFT',
        environment: 'DEV',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    rolledBack = error instanceof VisPersistenceError;
  }
  assert(rolledBack, 'failed transaction throws');
  assert(txStore.get('integrations', 'tx-rollback') == null, 'failed transaction rolls memory back');
  assert(!mock.rows('vis_integrations').some((row) => row.id === 'tx-rollback'), 'failed transaction writes nothing');
}

async function testSecrets() {
  useSupabaseTestEnv();
  const mock = createMockSupabase();
  setVisSupabaseClientForTests(mock.client);
  await resetVisStoreSupabaseForTests();
  const secrets = new LocalEncryptedSecretProvider();
  await secrets.put('ref-1', 'plain-secret');
  const stored = mock.rows('vis_secret_blobs').find((row) => row.ref_id === 'ref-1');
  assert(stored, 'ciphertext row stored');
  assert(stored.ciphertext !== 'plain-secret', 'plaintext is not stored');
  assert(await secrets.get('ref-1') === 'plain-secret', 'secret round trip');
  (secrets as unknown as { memory: Map<string, string> }).memory.clear();
  assert(await secrets.get('ref-1') === 'plain-secret', 'secret reloaded from supabase');
  await secrets.rotate('ref-1', 'rotated-secret');
  assert(await secrets.get('ref-1') === 'rotated-secret', 'rotated secret');
  assert(mock.rows('vis_secret_blobs').find((row) => row.ref_id === 'ref-1')?.rotated_at, 'rotated_at stored');
  await secrets.delete('ref-1');
  assert(await secrets.get('ref-1') === null, 'deleted secret');
  assert(!mock.rows('vis_secret_blobs').some((row) => row.ref_id === 'ref-1'), 'blob removed');

  mock.failNext('vis_secret_blobs', 'insert', { message: 'write failed', code: '42501' });
  let writeFailed = false;
  try {
    await secrets.put('ref-2', 'nope');
  } catch (error) {
    writeFailed = error instanceof Error && /write failed/.test(error.message);
  }
  assert(writeFailed, 'secret write error surfaces');
}

async function testProductionStartupWithoutDatabaseUrl() {
  const mock = createMockSupabase();
  setVisSupabaseClientForTests(mock.client);
  delete process.env.VIS_DATABASE_URL;
  delete process.env.VIS_STORE_MEMORY;
  delete process.env.VIS_ALLOW_FILE_STORE;
  process.env.NODE_ENV = 'production';
  process.env.VIS_PERSISTENCE = 'memory';
  let memoryBlocked = false;
  try {
    new VisStore('/tmp/vis-memory-should-fail.json');
  } catch (error) {
    memoryBlocked = error instanceof Error && /forbidden/i.test(error.message);
    assert(!/VIS_DATABASE_URL is required in production for Prisma/.test((error as Error).message), 'old prisma error is gone');
  }
  assert(memoryBlocked, 'production rejects memory persistence');

  delete process.env.VIS_PERSISTENCE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let missingCreds = false;
  try {
    new VisStore('/tmp/vis-missing-supabase.json');
  } catch (error) {
    missingCreds = error instanceof Error && /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/.test(error.message);
    assert(!/Prisma persistence/.test((error as Error).message), 'missing creds do not mention Prisma');
  }
  assert(missingCreds, 'production requires supabase credentials');

  process.env.VIS_PERSISTENCE = 'supabase';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  const direct = new VisStore('/tmp/vis-supabase-startup.json');
  assert(direct.isSupabaseBacked, 'production store starts without VIS_DATABASE_URL');
  await direct.hydrate();
  assert(direct.list('mockForms').length >= 1, 'hydrate seeds forms through supabase');

  clearVisStoreForTests();
  const app = await NestFactory.create(VisBootModule, { logger: ['error'] });
  await app.init();
  const running = getVisStore();
  assert(running.isSupabaseBacked, 'nest boot uses supabase persistence');
  assert(!process.env.VIS_DATABASE_URL, 'nest boot did not require VIS_DATABASE_URL');
  await running.flushDurable();
  await app.close();
}

async function testFileModeStillAvailableOutsideProduction() {
  restoreEnv();
  delete process.env.VIS_DATABASE_URL;
  delete process.env.SUPABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.VIS_PERSISTENCE = 'memory';
  process.env.VIS_STORE_MEMORY = '1';
  const store = resetVisStoreForTests('/tmp/vis-memory-store.json');
  assert(!store.isSupabaseBacked, 'tests can still use memory mode');
  const row = store.create('integrations', { name: 'Memory', status: 'DRAFT' });
  assert(store.get('integrations', row.id)?.name === 'Memory', 'memory create');
}

async function main() {
  try {
    await testCrudFilterAndErrors();
    await testDocumentsAndTransaction();
    await testSecrets();
    await testProductionStartupWithoutDatabaseUrl();
    await testFileModeStillAvailableOutsideProduction();
    console.log('VIS_SUPABASE_PERSISTENCE_PASS');
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error('VIS_SUPABASE_PERSISTENCE_FAIL', error);
  process.exit(1);
});
