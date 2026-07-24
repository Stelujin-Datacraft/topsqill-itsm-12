import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

describe('Auth guards (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/database/query returns 401 without Authorization header', async () => {
    await request(app.getHttpServer())
      .post('/api/database/query')
      .send({ table: 'forms', select: 'id' })
      .expect(401);
  });

  it('POST /api/database/query returns 401 with invalid token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/database/query')
      .set('Authorization', 'Bearer invalid-token')
      .send({ table: 'forms', select: 'id' })
      .expect(401);

    expect(res.body.message).toBeDefined();
  });
});
