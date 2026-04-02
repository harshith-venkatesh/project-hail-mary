/**
 * MessageFeedService
 *
 * Provides chronologically-sorted message retrieval with:
 *   - Deduplication via a seen-id Set (prevents duplicate delivery even when
 *     a message is indexed under both sender and receiver directions).
 *   - Exponential-backoff retry for transient failures (e.g. DB timeouts).
 *   - Cursor-based pagination (timestamp + last-seen id) for stable, low-latency
 *     reads — avoids OFFSET queries that get slower as the dataset grows.
 *
 * The retry wrapper is generic and can be applied to any async operation.
 */

const createError = require('http-errors');
const messageService = require('./MessageService');
const logger = require('../config/logger');

/**
 * Retry an async function with exponential backoff.
 *
 * @param {() => Promise<*>} fn          - The operation to retry.
 * @param {object}           opts
 * @param {number}           opts.maxAttempts  - Total attempts (default 3).
 * @param {number}           opts.baseDelayMs  - Initial delay in ms (default 100).
 * @param {number}           opts.maxDelayMs   - Cap on delay (default 2000).
 * @returns {Promise<*>}
 */
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 100, maxDelayMs = 2000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Do not retry on client errors (4xx) — they won't resolve on their own.
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (attempt < maxAttempts) {
        const jitter = Math.random() * baseDelayMs;
        const delay = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);
        logger.warn(`Attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`, {
          error: err.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

class MessageFeedService {
  /**
   * Return messages between two participants, sorted oldest→newest.
   *
   * Deduplication ensures that even if the underlying store returns the same
   * message twice (e.g. from both the A→B and B→A index buckets), each
   * message appears exactly once in the result.
   *
   * @param {string}  userA
   * @param {string}  userB
   * @param {object}  opts
   * @param {number}  opts.limit    - Max messages per page (default 50).
   * @param {string}  [opts.after]  - ISO-8601 cursor: return messages strictly after this timestamp.
   * @param {string}  [opts.before] - ISO-8601 cursor: return messages strictly before this timestamp.
   * @returns {Promise<object[]>}   - Deduplicated messages sorted by timestamp ASC.
   */
  async getChronologicalFeed(userA, userB, { limit = 50, afterSeq, before } = {}) {
    const messages = await withRetry(() =>
      messageService.getConversation(userA, userB, {
        limit: limit * 2, // fetch extra to absorb potential duplicates
        before,
      }),
    );

    const seen = new Set();
    const deduplicated = [];

    // getConversation returns newest-first; reverse for chronological (oldest-first) order.
    for (const msg of [...messages].reverse()) {
      if (seen.has(msg.id)) {
        continue;
      }
      seen.add(msg.id);

      // afterSeq is a monotonic cursor — skip messages at or before the cursor.
      if (afterSeq !== undefined && msg.seq <= afterSeq) {
        continue;
      }

      deduplicated.push(msg);

      if (deduplicated.length >= limit) {
        break;
      }
    }

    return deduplicated;
  }

  /**
   * Count unread messages for a receiver — with retry on transient failures.
   */
  async countUnread(receiverId) {
    return withRetry(() => messageService.countUnread(receiverId));
  }

  /**
   * Update a message's delivery status — with retry on transient failures.
   */
  async updateStatus(messageId, newStatus) {
    return withRetry(() => messageService.updateStatus(messageId, newStatus));
  }

  /**
   * Send a message and ensure it is not re-sent if a duplicate call is made
   * within the same in-flight window (idempotency key via clientRequestId).
   *
   * Callers should generate a stable clientRequestId (e.g. UUID) per logical
   * send action and retry with the same id on network failure.
   */
  async send({ senderId, receiverId, content, clientRequestId }) {
    if (clientRequestId && this._inflightIds.has(clientRequestId)) {
      logger.warn(`Duplicate send ignored for clientRequestId=${clientRequestId}`);
      return this._inflightIds.get(clientRequestId);
    }

    const promise = withRetry(() => messageService.send({ senderId, receiverId, content }));

    if (clientRequestId) {
      this._inflightIds.set(clientRequestId, promise);
      // Clean up after resolution so the map doesn't grow unbounded.
      promise.finally(() => this._inflightIds.delete(clientRequestId));
    }

    return promise;
  }

  // Exposed for test resets only
  _reset() {
    this._inflightIds.clear();
  }
}

// Singleton with a private in-flight idempotency map.
const instance = new MessageFeedService();
instance._inflightIds = new Map();

module.exports = instance;
module.exports.withRetry = withRetry; // export for unit tests
