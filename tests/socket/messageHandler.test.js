/**
 * messageHandler tests
 *
 * Spins up a real Socket.io server in-process for integration-level tests.
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const presenceHandler = require('../../src/socket/handlers/presenceHandler');
const messageHandler = require('../../src/socket/handlers/messageHandler');
const presenceService = require('../../src/services/PresenceService');
const messageService = require('../../src/services/MessageService');
const Message = require('../../src/models/Message');

const ALICE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BOB_ID = 'b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

function buildServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, { pingTimeout: 300 });
  io.on('connection', (socket) => {
    presenceHandler(io, socket);
    messageHandler(io, socket);
  });
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      resolve({ io, httpServer, port: httpServer.address().port });
    });
  });
}

function connect(port) {
  return new Promise((resolve) => {
    const s = Client(`http://localhost:${port}`, { forceNew: true });
    s.on('connect', () => resolve(s));
  });
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

let io, httpServer, port;

beforeEach(async () => {
  presenceService._reset();
  messageService._reset();
  Message._resetSeq();
  ({ io, httpServer, port } = await buildServer());
});

afterEach(() => {
  io.close();
  httpServer.close();
});

describe('messageHandler', () => {
  describe('message:send', () => {
    it('confirms send to sender and delivers to receiver', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: ALICE_ID });
      bob.emit('presence:join', { userId: BOB_ID });
      await new Promise((r) => setTimeout(r, 50));

      const sentPromise = once(alice, 'message:sent');
      const newPromise = once(bob, 'message:new');

      alice.emit('message:send', {
        senderId: ALICE_ID,
        receiverId: BOB_ID,
        content: 'Hello Bob!',
      });

      const [{ message: sent }, { message: received }] = await Promise.all([sentPromise, newPromise]);

      expect(sent.content).toBe('Hello Bob!');
      expect(received.content).toBe('Hello Bob!');
      expect(sent.id).toBe(received.id);
      expect(sent.status).toBe('sent');

      alice.disconnect();
      bob.disconnect();
    });

    it('emits error when required fields are missing', async () => {
      const alice = await connect(port);
      const errPromise = once(alice, 'error');
      alice.emit('message:send', { senderId: ALICE_ID });
      const err = await errPromise;
      expect(err.message).toMatch(/senderId|receiverId|content/);
      alice.disconnect();
    });

    it('deduplicates sends with the same clientRequestId', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: ALICE_ID });
      bob.emit('presence:join', { userId: BOB_ID });
      await new Promise((r) => setTimeout(r, 50));

      const received = [];
      bob.on('message:new', (data) => received.push(data));

      const payload = { senderId: ALICE_ID, receiverId: BOB_ID, content: 'idem', clientRequestId: 'req-1' };
      alice.emit('message:send', payload);
      alice.emit('message:send', payload);

      await new Promise((r) => setTimeout(r, 100));
      expect(received).toHaveLength(1);

      alice.disconnect();
      bob.disconnect();
    });
  });

  describe('message:delivered', () => {
    it('updates status to delivered and notifies sender', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: ALICE_ID });
      bob.emit('presence:join', { userId: BOB_ID });
      await new Promise((r) => setTimeout(r, 50));

      alice.emit('message:send', { senderId: ALICE_ID, receiverId: BOB_ID, content: 'Hi' });
      const { message } = await once(bob, 'message:new');

      const statusPromise = once(alice, 'message:status_updated');
      bob.emit('message:delivered', { messageId: message.id, receiverId: BOB_ID });

      const update = await statusPromise;
      expect(update.messageId).toBe(message.id);
      expect(update.status).toBe('delivered');

      alice.disconnect();
      bob.disconnect();
    });
  });

  describe('message:read', () => {
    it('updates status to read and notifies sender', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: ALICE_ID });
      bob.emit('presence:join', { userId: BOB_ID });
      await new Promise((r) => setTimeout(r, 50));

      alice.emit('message:send', { senderId: ALICE_ID, receiverId: BOB_ID, content: 'Read me' });
      const { message } = await once(bob, 'message:new');

      // Must go through delivered first
      bob.emit('message:delivered', { messageId: message.id, receiverId: BOB_ID });
      await once(alice, 'message:status_updated');

      const readPromise = once(alice, 'message:status_updated');
      bob.emit('message:read', { messageId: message.id });

      const update = await readPromise;
      expect(update.status).toBe('read');

      alice.disconnect();
      bob.disconnect();
    });

    it('emits error when messageId is missing', async () => {
      const alice = await connect(port);
      const errPromise = once(alice, 'error');
      alice.emit('message:read', {});
      const err = await errPromise;
      expect(err.message).toMatch(/messageId/);
      alice.disconnect();
    });
  });
});
