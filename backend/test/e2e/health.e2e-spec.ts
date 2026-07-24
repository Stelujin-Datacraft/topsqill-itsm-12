import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok without auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
