import request from 'supertest';
import { app } from './index';
import { initDb, getDb } from './db';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Set to test env
    process.env.NODE_ENV = 'test';
    await initDb();
  });

  describe('Health Check', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Auth Flow', () => {
    it('should fail login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('Public Registration', () => {
    it('should return 404 for non-existent link', async () => {
      const res = await request(app).get('/api/pub/link/invalid-slug');
      expect(res.status).toBe(404);
    });
  });
});
