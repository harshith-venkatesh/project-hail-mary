const createError = require('http-errors');
const Message = require('../models/Message');

// In-memory store keyed by message id.
// Index structures mirror the DB indexes described in Message.schema for O(1)/O(n) lookups.
const store = new Map();

// Simulated composite index: "senderId:receiverId" → Set of message ids
// Covers both (A→B) and (B→A) directions by storing under both keys.
const conversationIndex = new Map();

// Simulated index: receiverId → Set of message ids where status !== 'read'
const unreadIndex = new Map();

function _indexKey(a, b) {
  return [a, b].sort().join(':');
}

function _addToConversationIndex(msg) {
  const key = _indexKey(msg.senderId, msg.receiverId);
  if (!conversationIndex.has(key)) {
    conversationIndex.set(key, new Set());
  }
  conversationIndex.get(key).add(msg.id);
}

function _addToUnreadIndex(msg) {
  if (msg.status !== Message.STATUS.READ) {
    if (!unreadIndex.has(msg.receiverId)) {
      unreadIndex.set(msg.receiverId, new Set());
    }
    unreadIndex.get(msg.receiverId).add(msg.id);
  }
}

function _removeFromUnreadIndex(msg) {
  const set = unreadIndex.get(msg.receiverId);
  if (set) {
    set.delete(msg.id);
  }
}

class MessageService {
  async send({ senderId, receiverId, content }) {
    const msg = new Message({ senderId, receiverId, content });
    store.set(msg.id, msg);
    _addToConversationIndex(msg);
    _addToUnreadIndex(msg);
    return msg.toJSON();
  }u

  async findById(id) {
    const msg = store.get(id);
    if (!msg) {
      throw createError(404, `Message '${id}' not found`);
    }
    return msg.toJSON();
  }

  /**
   * Retrieve conversation between two users, newest-first.
   * Uses the composite conversation index for low-latency lookup.
   */
  async getConversation(userA, userB, { limit = 50, before } = {}) {
    const key = _indexKey(userA, userB);
    const ids = conversationIndex.get(key) || new Set();

    let messages = [...ids]
      .map((id) => store.get(id))
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp || b.seq - a.seq); // newest first, seq as tiebreaker

    if (before) {
      const pivot = new Date(before);
      messages = messages.filter((m) => m.timestamp < pivot);
    }

    return messages.slice(0, limit).map((m) => m.toJSON());
  }

  /**
   * Count unread messages for a receiver.
   * Uses the unread index for O(1) count.
   */
  async countUnread(receiverId) {
    return (unreadIndex.get(receiverId) || new Set()).size;
  }

  /**
   * Update message status (sent → delivered → read).
   */
  async updateStatus(id, newStatus) {
    const msg = store.get(id);
    if (!msg) {
      throw createError(404, `Message '${id}' not found`);
    }

    const wasUnread = msg.status !== Message.STATUS.READ;
    msg.updateStatus(newStatus); // throws if invalid transition

    // Keep unread index consistent
    if (newStatus === Message.STATUS.READ && wasUnread) {
      _removeFromUnreadIndex(msg);
    }

    return msg.toJSON();
  }

  // Exposed for test resets only
  _reset() {
    store.clear();
    conversationIndex.clear();
    unreadIndex.clear();
  }
}

module.exports = new MessageService();
