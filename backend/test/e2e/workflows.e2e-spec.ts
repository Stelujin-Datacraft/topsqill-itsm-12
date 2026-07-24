import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

describe('Workflows API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({
      queryResults: {
        workflows: {
          data: { id: 'wf-1', status: 'active', enrollment_mode: 'allow_always' },
          error: null,
        },
        workflow_queue: {
          data: [],
          error: null,
        },
      },
      rpcResults: {
        claim_workflow_queue_batch: { data: [], error: null },
      },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/workflows/enqueue requires workflow_id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workflows/enqueue')
      .send({ submission_id: 'sub-1' })
      .expect(201);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/workflow_id/i);
  });

  it('POST /api/workflows/process-queue is public and returns result', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workflows/process-queue')
      .send({})
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('POST /api/workflows/notify-failure rejects invalid entity_type', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workflows/notify-failure')
      .send({ entity_type: 'invalid', entity_id: 'x', error: 'test' })
      .expect(201);

    expect(res.body.error).toBeDefined();
  });
});
