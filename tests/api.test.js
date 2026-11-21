import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

let app;
let db;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  const databaseModule = await import('../src/db/database.js');
  db = databaseModule.db;
  ({ default: app } = await import('../src/app.js'));
});

beforeEach(() => {
  db.exec('DELETE FROM incidents; DELETE FROM checks; DELETE FROM monitors; DELETE FROM users;');
});

async function createAdmin() {
  const response = await request(app).post('/api/auth/register').send({
    username: 'admin',
    password: 'password123'
  });
  expect(response.status).toBe(201);
  return response.body.token;
}

describe('NetWatch API', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('creates, updates, lists, and deletes a monitor', async () => {
    const token = await createAdmin();
    const headers = { Authorization: `Bearer ${token}` };
    const created = await request(app).post('/api/monitors')
      .set(headers).send({
      name: 'Test ping',
      type: 'ping',
      target: '1.1.1.1'
    });
    expect(created.status).toBe(201);
    expect(created.body.current_status).toBe('unknown');

    const updated = await request(app).put(`/api/monitors/${created.body.id}`)
      .set(headers).send({
      enabled: false
    });
    expect(updated.status).toBe(200);
    expect(updated.body.current_status).toBe('paused');

    const listed = await request(app).get('/api/monitors');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const deleted = await request(app).delete(`/api/monitors/${created.body.id}`)
      .set(headers);
    expect(deleted.status).toBe(204);
  });

  it('rejects invalid monitor input', async () => {
    const token = await createAdmin();
    const response = await request(app).post('/api/monitors')
      .set('Authorization', `Bearer ${token}`).send({
      name: 'Bad target',
      type: 'ping',
      target: '1.1.1.1; calc'
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('target');
  });

  it('returns summary totals', async () => {
    const token = await createAdmin();
    await request(app).post('/api/monitors')
      .set('Authorization', `Bearer ${token}`).send({
      name: 'Test web',
      type: 'http',
      target: 'https://example.com'
    });
    const response = await request(app).get('/api/summary');
    expect(response.status).toBe(200);
    expect(response.body.monitors).toBe(1);
  });
});
