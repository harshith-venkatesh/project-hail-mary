/**
 * Message model schema definition.
 *
 * Low-latency retrieval strategy:
 *   1. Composite index on (senderId, receiverId, timestamp DESC)
 *      → Covers the most common query: "get conversation between two users, newest first"
 *      → Both (A→B) and (B→A) directions are covered by querying both orderings.
 *
 *   2. Index on (receiverId, status)
 *      → Covers unread-count queries: WHERE receiverId = ? AND status != 'read'
 *
 *   3. Index on timestamp
 *      → Covers time-range scans (e.g. messages in last N hours)
 *
 *   4. createdAt / updatedAt are managed automatically — index updatedAt if you
 *      need to poll for recently changed message statuses (e.g. delivery receipts).
 *
 * Column-level notes:
 *   - senderId / receiverId should be foreign keys to the users table.
 *   - status is an enum to keep the column narrow (fits in a single byte in most engines).
 *   - content is stored as TEXT; consider a separate FTS index if full-text search is needed.
 */

const { randomUUID } = require('crypto');

// Module-level monotonic counter — guarantees insertion order even when
// multiple messages share the same millisecond timestamp.
let _seq = 0;

const MESSAGE_STATUS = Object.freeze({
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
});

class Message {
  /**
   * @param {object} data
   * @param {string} data.senderId
   * @param {string} data.receiverId
   * @param {string} data.content
   * @param {string} [data.status]
   */
  constructor({ senderId, receiverId, content, status = MESSAGE_STATUS.SENT }) {
    if (!senderId) {
      throw new Error('senderId is required');
    }
    if (!receiverId) {
      throw new Error('receiverId is required');
    }
    if (!content || content.trim() === '') {
      throw new Error('content is required');
    }
    if (!Object.values(MESSAGE_STATUS).includes(status)) {
      throw new Error(`status must be one of: ${Object.values(MESSAGE_STATUS).join(', ')}`);
    }

    this.id = randomUUID();
    this.seq = ++_seq; // monotonic insertion order
    this.senderId = senderId;
    this.receiverId = receiverId;
    this.content = content.trim();
    this.status = status;
    this.timestamp = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Transition to a new status, enforcing the allowed state machine:
   *   sent → delivered → read
   */
  updateStatus(newStatus) {
    const order = [MESSAGE_STATUS.SENT, MESSAGE_STATUS.DELIVERED, MESSAGE_STATUS.READ];
    const currentIndex = order.indexOf(this.status);
    const nextIndex = order.indexOf(newStatus);

    if (nextIndex === -1) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    if (nextIndex <= currentIndex) {
      throw new Error(`Cannot transition from '${this.status}' to '${newStatus}'`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      seq: this.seq,
      senderId: this.senderId,
      receiverId: this.receiverId,
      content: this.content,
      status: this.status,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Schema definition with index hints (use this to drive migrations).
 *
 * DB indexes:
 *   COMPOSITE INDEX idx_conversation  ON messages (senderId, receiverId, timestamp DESC)
 *   INDEX          idx_receiver_status ON messages (receiverId, status)
 *   INDEX          idx_timestamp        ON messages (timestamp DESC)
 *   INDEX          idx_updated_at       ON messages (updatedAt DESC)   -- optional, for polling
 */
Message.schema = {
  id: { type: 'uuid', primaryKey: true },
  senderId: { type: 'uuid', required: true, references: 'users.id' },
  receiverId: { type: 'uuid', required: true, references: 'users.id' },
  content: { type: 'text', required: true },
  status: { type: 'enum', values: Object.values(MESSAGE_STATUS), default: MESSAGE_STATUS.SENT },
  timestamp: { type: 'timestamp', default: 'NOW()' },
  createdAt: { type: 'timestamp', default: 'NOW()' },
  updatedAt: { type: 'timestamp', default: 'NOW()', onUpdate: 'NOW()' },
};

Message.STATUS = MESSAGE_STATUS;

// Used by tests to reset the counter so seq values are predictable.
Message._resetSeq = () => { _seq = 0; };

module.exports = Message;
