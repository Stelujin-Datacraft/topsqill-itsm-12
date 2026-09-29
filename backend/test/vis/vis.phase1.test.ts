/**
 * Phase 1 API / unit tests for Versatile Integration Studio.
 * Run: npx tsx backend/test/vis/vis.phase1.test.ts
 */
import { VisAssistant, MockAIProvider } from '../../src/vis/ai/vis-assistant';
import { VisService } from '../../src/vis/integrations/vis.service';
import { validateIntegrationDesign } from '../../src/vis/core/schemas/integrationDesign';
import { assertSafeOutboundUrl, maskSecrets } from '../../src/vis/core/security/index';
import { resetVisStoreForTests } from '../../src/vis/store/vis.store';
import { resolve } from 'path';
import { rmSync, existsSync } from 'fs';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const storePath = resolve(process.cwd(), 'backend/.vis-data/test-store.json');
  process.env.VIS_STORE_PATH = storePath;
  if (existsSync(storePath)) rmSync(storePath);
  const store = resetVisStoreForTests(storePath);

  const assistant = new VisAssistant(new MockAIProvider());
  const design = await assistant.analyzeRequirement(
    'Get all open vulnerabilities from ServiceNow every 15 minutes, map them to our internal Vulnerability form, and create or update the records.',
  );
  validateIntegrationDesign(design);
  assert(design.source === 'REST_API', 'source REST');
  assert(design.target === 'INTERNAL_APPLICATION_API', 'target internal');
  assert(design.executionMode === 'SCHEDULED', 'scheduled');
  assert(design.frequency === '15_MINUTES', '15 min');
  assert(design.language === 'PYTHON', 'python recommended');
  assert(design.operations.includes('UPSERT') || design.operations.includes('UPDATE'), 'upsert ops');

  const lang = await assistant.recommendLanguage(design);
  assert(lang.language, 'language present');
  assert(lang.reason.length > 5, 'language reason');

  try {
    assertSafeOutboundUrl('http://127.0.0.1/admin');
    throw new Error('should block private');
  } catch (e: any) {
    assert(/blocked|private|Invalid/i.test(e.message), 'ssrf blocked');
  }
  assertSafeOutboundUrl('https://api.example.com/v1');
  const masked = maskSecrets({ apiKey: 'supersecret', nested: { password: 'x' } }) as any;
  assert(masked.apiKey === '***REDACTED***', 'mask apiKey');

  const vis = new VisService();

  const created = vis.createIntegration({
    name: 'Test',
    promptText:
      'Get open vulnerabilities from ServiceNow every 15 minutes and create or update records in our internal Vulnerability form.',
  });
  assert(created.id, 'created id');
  assert(created.status === 'DRAFT', 'draft');

  const analyzed = await vis.analyzeIntegration(created.id);
  assert(analyzed.design, 'design set');
  assert(analyzed.directions?.length >= 1, 'direction');

  const changed = vis.setLanguage(created.id, 'GO');
  assert(changed.design.language === 'GO', 'language override');

  const conn = vis.createConnection({
    name: 'Mock Internal',
    kind: 'INTERNAL_APPLICATION_API',
    baseUrl: 'http://127.0.0.1:3001/api/vis/mocks',
    authType: 'NONE',
    allowPrivateNetwork: true,
    config: {
      paths: {
        formsPath: '/forms',
        formFieldsPath: '/forms/{formId}/fields',
        recordsPath: '/forms/{formId}/records',
        recordByIdPath: '/forms/{formId}/records/{recordId}',
      },
    },
  });
  assert(conn.id, 'connection');
  assert(!('_secretPayload' in conn), 'no secret leak');

  const forms = store.list('mockForms');
  assert(forms.length >= 1, 'mock forms seeded');
  assert(forms.some((f) => f.name === 'Vulnerability'), 'vulnerability form');

  const mappings = await vis.suggestMappings(created.id, {
    sourceFields: [{ name: 'id' }, { name: 'severity' }, { name: 'description' }, { name: 'team' }],
  });
  assert(Array.isArray(mappings), 'mappings array');

  const saved = vis.saveMappings(
    created.id,
    mappings.length
      ? mappings
      : [
          {
            id: 'm1',
            sourceField: 'id',
            targetField: 'vulnerability_id',
            confidence: 'HIGH' as const,
            enabled: true,
          },
        ],
  );
  assert(saved.length >= 1, 'saved mappings');

  const validated = await vis.validateIntegration(created.id);
  assert(validated.ok === true, 'validated ok');
  assert(validated.integration.status === 'VALIDATED', 'status validated');

  const exec = vis.createExecution(created.id);
  assert(exec.correlationId, 'correlation id');
  const detail = vis.getExecution(String(exec.id));
  assert((detail.logs || []).length >= 1, 'logs present');

  const dash = vis.getDashboard();
  assert(dash.totalIntegrations >= 1, 'dashboard count');

  console.log('VIS_PHASE1_TESTS_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
