const messageService = require('../../src/services/MessageService');
const Message = require('../../src/models/Message');

const SENDER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const RECEIVER = 'b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

beforeEach(() => messageService._reset());

describe('MessageService', () => {
  describe('send', () => {
    it('creates and returns a message', async () => {
      const msg = await messageService.send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Hello!',
      });
      expect(msg).toMatchObject({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Hello!',
        status: Message.STATUS.SENT,
      });
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns the message when found', async () => {
      const sent = await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'Hi' });
      const found = await messageService.findById(sent.id);
      expect(found.id).toBe(sent.id);
    });

    it('throws 404 for unknown id', async () => {
      await expect(
        messageService.findById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getConversation', () => {
    it('returns messages between two users, newest first', async () => {
      await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'First' });
      await messageService.send({ senderId: RECEIVER, receiverId: SENDER, content: 'Reply' });

      const messages = await messageService.getConversation(SENDER, RECEIVER);
      expect(messages).toHaveLength(2);
      expect(messages[0].timestamp >= messages[1].timestamp).toBe(true);
    });

    it('respects the limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: `msg ${i}` });
      }
      const messages = await messageService.getConversation(SENDER, RECEIVER, { limit: 3 });
      expect(messages).toHaveLength(3);
    });

    it('returns empty array when no messages exist', async () => {
      const messages = await messageService.getConversation(SENDER, RECEIVER);
      expect(messages).toEqual([]);
    });
  });

  describe('countUnread', () => {
    it('counts unread messages for a receiver', async () => {
      await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'A' });
      await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'B' });
      expect(await messageService.countUnread(RECEIVER)).toBe(2);
    });

    it('decrements count when message is marked as read', async () => {
      const msg = await messageService.send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'C',
      });
      await messageService.updateStatus(msg.id, Message.STATUS.DELIVERED);
      await messageService.updateStatus(msg.id, Message.STATUS.READ);
      expect(await messageService.countUnread(RECEIVER)).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('advances status through the state machine', async () => {
      const msg = await messageService.send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Test',
      });
      const delivered = await messageService.updateStatus(msg.id, Message.STATUS.DELIVERED);
      expect(delivered.status).toBe(Message.STATUS.DELIVERED);

      const read = await messageService.updateStatus(msg.id, Message.STATUS.READ);
      expect(read.status).toBe(Message.STATUS.READ);
    });

    it('throws when reversing status', async () => {
      const msg = await messageService.send({
        senderId: SENDER,
        receiverId: RECEIVER,
        content: 'Test',
      });
      await messageService.updateStatus(msg.id, Message.STATUS.DELIVERED);
      await expect(
        messageService.updateStatus(msg.id, Message.STATUS.SENT),
      ).rejects.toThrow();
    });

    it('throws 404 for unknown id', async () => {
      await expect(
        messageService.updateStatus('00000000-0000-0000-0000-000000000000', Message.STATUS.READ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
