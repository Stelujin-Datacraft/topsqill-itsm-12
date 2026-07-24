/**
 * Optional live E2E tests — run against a real backend + Supabase instance.
 *
 * Usage:
 *   E2E_LIVE=true SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e:live
 *
 * Skipped automatically when E2E_LIVE is not set.
 */
import request from 'supertest';

const live = process.env.E2E_LIVE === 'true';
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3001';

(live ? describe : describe.skip)('Live API (e2e)', () => {
  it('GET /api/health is reachable', async () => {
    const res = await request(baseUrl).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  }, 15000);

  it('POST /api/database/query requires auth on live server', async () => {
    await request(baseUrl)
      .post('/api/database/query')
      .send({ table: 'forms', select: 'id', limit: 1 })
      .expect(401);
  }, 15000);
});
