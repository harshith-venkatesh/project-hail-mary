const request = require('supertest');
const app = require('../../src/app');
const messageService = require('../../src/services/MessageService');

const SENDER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const RECEIVER = 'b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

beforeEach(() => messageService._reset());

describe('Messages API', () => {
  describe('POST /api/messages', () => {
    it('sends a message and returns 201', async () => {
      const res = await request(app).post('/api/messages').send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Hello!',
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Hello!',
        status: 'sent',
      });
    });

    it('returns 422 for missing content', async () => {
      const res = await request(app).post('/api/messages').send({
        senderId: SENDER,
        receiverId: RECEIVER,
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid sender UUID', async () => {
      const res = await request(app).post('/api/messages').send({
        senderId: 'not-a-uuid',
        receiverId: RECEIVER,
        content: 'Hi',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/messages/conversation/:userA/:userB', () => {
    it('returns messages between two users', async () => {
      await request(app)
        .post('/api/messages')
        .send({ senderId: SENDER, receiverId: RECEIVER, content: 'A' });
      await request(app)
        .post('/api/messages')
        .send({ senderId: RECEIVER, receiverId: SENDER, content: 'B' });

      const res = await request(app).get(
        `/api/messages/conversation/${SENDER}/${RECEIVER}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('respects limit query param', async () => {
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/messages')
          .send({ senderId: SENDER, receiverId: RECEIVER, content: `msg ${i}` });
      }
      const res = await request(app).get(
        `/api/messages/conversation/${SENDER}/${RECEIVER}?limit=2`,
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/messages/unread/:receiverId', () => {
    it('returns unread count', async () => {
      await request(app)
        .post('/api/messages')
        .send({ senderId: SENDER, receiverId: RECEIVER, content: 'X' });
      const res = await request(app).get(`/api/messages/unread/${RECEIVER}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
    });
  });

  describe('PATCH /api/messages/:id/status', () => {
    it('updates message status', async () => {
      const send = await request(app).post('/api/messages').send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Status test',
      });
      const id = send.body.data.id;
      const res = await request(app).patch(`/api/messages/${id}/status`).send({ status: 'delivered' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('delivered');
    });

    it('returns 422 for invalid status value', async () => {
      const send = await request(app).post('/api/messages').send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'X',
      });
      const res = await request(app)
        .patch(`/api/messages/${send.body.data.id}/status`)
        .send({ status: 'unknown' });
      expect(res.status).toBe(422);
    });
  });
});
