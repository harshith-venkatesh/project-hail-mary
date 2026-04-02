/**
 * presenceHandler tests
 *
 * Uses a real Socket.io server spun up in-process on a random port.
 * Each test gets a fresh server + fresh PresenceService state.
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const presenceHandler = require('../../src/socket/handlers/presenceHandler');
const presenceService = require('../../src/services/PresenceService');

function buildServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, { pingTimeout: 300, pingInterval: 200 });
  io.on('connection', (socket) => presenceHandler(io, socket));
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const { port } = httpServer.address();
      resolve({ io, httpServer, port });
    });
  });
}

function connect(port) {
  return new Promise((resolve) => {
    const socket = Client(`http://localhost:${port}`, { forceNew: true });
    socket.on('connect', () => resolve(socket));
  });
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

let io, httpServer, port;

beforeEach(async () => {
  presenceService._reset();
  ({ io, httpServer, port } = await buildServer());
});

afterEach(() => {
  io.close();
  httpServer.close();
});

describe('presenceHandler', () => {
  describe('presence:join', () => {
    it('emits presence:online_list back to the joining socket', async () => {
      const socket = await connect(port);
      const listPromise = once(socket, 'presence:online_list');
      socket.emit('presence:join', { userId: 'user-A' });
      const { onlineUserIds } = await listPromise;
      expect(onlineUserIds).toContain('user-A');
      socket.disconnect();
    });

    it('broadcasts presence:online to other connected sockets', async () => {
      const observer = await connect(port);
      const onlinePromise = once(observer, 'presence:online');

      const joiner = await connect(port);
      joiner.emit('presence:join', { userId: 'user-B' });

      const { userId } = await onlinePromise;
      expect(userId).toBe('user-B');

      observer.disconnect();
      joiner.disconnect();
    });

    it('emits error when userId is missing', async () => {
      const socket = await connect(port);
      const errPromise = once(socket, 'error');
      socket.emit('presence:join', {});
      const err = await errPromise;
      expect(err.message).toMatch(/userId/);
      socket.disconnect();
    });

    it('does NOT broadcast presence:online again for a second socket from same user', async () => {
      const observer = await connect(port);

      // First socket brings user online
      const socket1 = await connect(port);
      socket1.emit('presence:join', { userId: 'user-C' });
      await once(observer, 'presence:online');

      // Second socket from same user should not re-broadcast
      let extraOnline = false;
      observer.on('presence:online', () => { extraOnline = true; });

      const socket2 = await connect(port);
      socket2.emit('presence:join', { userId: 'user-C' });
      await new Promise((r) => setTimeout(r, 80));

      expect(extraOnline).toBe(false);

      socket1.disconnect();
      socket2.disconnect();
      observer.disconnect();
    });
  });

  describe('presence:typing / presence:stop_typing', () => {
    it('delivers presence:typing only to the partner', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: 'alice' });
      bob.emit('presence:join', { userId: 'bob' });
      await new Promise((r) => setTimeout(r, 50));

      const typingPromise = once(bob, 'presence:typing');
      alice.emit('presence:typing', { userId: 'alice', partnerId: 'bob' });

      const event = await typingPromise;
      expect(event).toMatchObject({ userId: 'alice', partnerId: 'bob' });

      alice.disconnect();
      bob.disconnect();
    });

    it('delivers presence:stop_typing to the partner', async () => {
      const alice = await connect(port);
      const bob = await connect(port);

      alice.emit('presence:join', { userId: 'alice' });
      bob.emit('presence:join', { userId: 'bob' });
      await new Promise((r) => setTimeout(r, 50));

      alice.emit('presence:typing', { userId: 'alice', partnerId: 'bob' });
      await new Promise((r) => setTimeout(r, 20));

      const stopPromise = once(bob, 'presence:stop_typing');
      alice.emit('presence:stop_typing', { userId: 'alice', partnerId: 'bob' });

      const event = await stopPromise;
      expect(event).toMatchObject({ userId: 'alice', partnerId: 'bob' });

      alice.disconnect();
      bob.disconnect();
    });
  });

  describe('disconnect', () => {
    it('broadcasts presence:offline when last socket disconnects', async () => {
      const observer = await connect(port);
      const user = await connect(port);
      user.emit('presence:join', { userId: 'user-D' });
      await once(observer, 'presence:online');

      const offlinePromise = once(observer, 'presence:offline');
      user.disconnect();

      const { userId } = await offlinePromise;
      expect(userId).toBe('user-D');
      observer.disconnect();
    });

    it('does NOT broadcast presence:offline if another socket remains', async () => {
      const observer = await connect(port);

      const s1 = await connect(port);
      const s2 = await connect(port);
      s1.emit('presence:join', { userId: 'user-E' });
      s2.emit('presence:join', { userId: 'user-E' });
      await new Promise((r) => setTimeout(r, 50));

      let wentOffline = false;
      observer.on('presence:offline', () => { wentOffline = true; });

      s1.disconnect();
      await new Promise((r) => setTimeout(r, 80));
      expect(wentOffline).toBe(false);

      s2.disconnect();
      observer.disconnect();
    });
  });
});
