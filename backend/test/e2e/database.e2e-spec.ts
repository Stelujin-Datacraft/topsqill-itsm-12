import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { testUser as mockUser } from '../mocks/supabase.mock';

describe('Database API (e2e)', () => {
  let app: INestApplication;
  const authHeader = 'Bearer test-jwt-token';

  beforeAll(async () => {
    ({ app } = await createTestApp({
      user: mockUser,
      queryResults: {
        forms: { data: [{ id: 'form-1', name: 'Test Form' }], error: null, count: 1 },
      },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/database/query succeeds with valid auth', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/query')
      .set('Authorization', authHeader)
      .send({ table: 'forms', select: 'id, name', limit: 10 })
      .expect(201);

    expect(res.body.data).toBeDefined();
  });

  it('POST /api/database/query rejects invalid table name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/query')
      .set('Authorization', authHeader)
      .send({ table: 'forms;drop', select: '*' })
      .expect(400);

    expect(res.body.message).toMatch(/invalid table/i);
  });

  it('POST /api/database/query rejects limit above max', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/query')
      .set('Authorization', authHeader)
      .send({ table: 'forms', select: 'id', limit: 5000 })
      .expect(400);

    expect(res.body.message).toMatch(/maximum/i);
  });

  it('POST /api/database/update requires filters', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/update')
      .set('Authorization', authHeader)
      .send({ table: 'forms', data: { name: 'x' }, filters: [] })
      .expect(400);

    expect(res.body.message).toMatch(/filters are required/i);
  });

  it('POST /api/database/delete requires filters', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/delete')
      .set('Authorization', authHeader)
      .send({ table: 'forms', filters: [] })
      .expect(400);

    expect(res.body.message).toMatch(/filters are required/i);
  });

  it('POST /api/database/rpc rejects invalid function name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/rpc')
      .set('Authorization', authHeader)
      .send({ function: 'drop-table', params: {} })
      .expect(400);

    expect(res.body.message).toMatch(/invalid rpc/i);
  });
});
