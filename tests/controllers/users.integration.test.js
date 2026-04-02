const request = require('supertest');
const app = require('../../src/app');
const userService = require('../../src/services/UserService');

beforeEach(() => userService._reset());

describe('Users API', () => {
  describe('POST /api/users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'Alice', email: 'alice@example.com' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    });

    it('returns 422 for missing name', async () => {
      const res = await request(app).post('/api/users').send({ email: 'a@x.com' });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('name');
    });

    it('returns 422 for invalid email', async () => {
      const res = await request(app).post('/api/users').send({ name: 'A', email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app).post('/api/users').send({ name: 'A', email: 'dup@x.com' });
      const res = await request(app).post('/api/users').send({ name: 'B', email: 'dup@x.com' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/users', () => {
    it('returns an empty list initially', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns the user', async () => {
      const create = await request(app)
        .post('/api/users')
        .send({ name: 'Bob', email: 'bob@x.com' });
      const res = await request(app).get(`/api/users/${create.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(create.body.data.id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('updates a user', async () => {
      const create = await request(app)
        .post('/api/users')
        .send({ name: 'Old', email: 'old@x.com' });
      const res = await request(app)
        .patch(`/api/users/${create.body.data.id}`)
        .send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes a user and returns 204', async () => {
      const create = await request(app)
        .post('/api/users')
        .send({ name: 'Del', email: 'del@x.com' });
      const res = await request(app).delete(`/api/users/${create.body.data.id}`);
      expect(res.status).toBe(204);
    });
  });
});
