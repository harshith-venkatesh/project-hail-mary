const messageService = require('../../src/services/MessageService');
const messageFeedService = require('../../src/services/MessageFeedService');
const { withRetry } = require('../../src/services/MessageFeedService');
const Message = require('../../src/models/Message');

const SENDER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const RECEIVER = 'b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

beforeEach(() => {
  messageService._reset();
  messageFeedService._reset();
  Message._resetSeq();
});

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    expect(await withRetry(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure and succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx client errors', async () => {
    const clientError = Object.assign(new Error('Not found'), { status: 404 });
    const fn = jest.fn().mockRejectedValue(clientError);
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toMatchObject({
      status: 404,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('MessageFeedService.getChronologicalFeed', () => {
  async function sendMsg(content) {
    return messageService.send({ senderId: SENDER, receiverId: RECEIVER, content });
  }

  it('returns messages in chronological order (oldest first)', async () => {
    await sendMsg('first');
    await sendMsg('second');
    await sendMsg('third');

    const feed = await messageFeedService.getChronologicalFeed(SENDER, RECEIVER);
    expect(feed.map((m) => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('deduplicates messages that appear in both index directions', async () => {
    // Send from both directions so both appear in the conversation index
    await messageService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'A→B' });
    await messageService.send({ senderId: RECEIVER, receiverId: SENDER, content: 'B→A' });

    const feed = await messageFeedService.getChronologicalFeed(SENDER, RECEIVER);

    // All ids must be unique
    const ids = feed.map((m) => m.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(feed).toHaveLength(2);
  });

  it('respects the limit option', async () => {
    for (let i = 0; i < 10; i++) {
      await sendMsg(`msg ${i}`);
    }
    const feed = await messageFeedService.getChronologicalFeed(SENDER, RECEIVER, { limit: 4 });
    expect(feed).toHaveLength(4);
  });

  it('respects the afterSeq cursor', async () => {
    await sendMsg('early');
    const pivot = await sendMsg('pivot');
    await sendMsg('late');

    const feed = await messageFeedService.getChronologicalFeed(SENDER, RECEIVER, {
      afterSeq: pivot.seq,
    });
    expect(feed.map((m) => m.content)).toEqual(['late']);
  });
});

describe('MessageFeedService.send (idempotency)', () => {
  it('does not duplicate sends when same clientRequestId is used concurrently', async () => {
    const sendSpy = jest.spyOn(messageService, 'send');

    const id = 'idem-key-abc';
    await Promise.all([
      messageFeedService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'Hi', clientRequestId: id }),
      messageFeedService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'Hi', clientRequestId: id }),
    ]);

    // messageService.send should have been called only once
    expect(sendSpy).toHaveBeenCalledTimes(1);
    sendSpy.mockRestore();
  });

  it('sends independently when no clientRequestId is provided', async () => {
    const sendSpy = jest.spyOn(messageService, 'send');

    await messageFeedService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'A' });
    await messageFeedService.send({ senderId: SENDER, receiverId: RECEIVER, content: 'B' });

    expect(sendSpy).toHaveBeenCalledTimes(2);
    sendSpy.mockRestore();
  });
});
