/**
 * PresenceService
 *
 * Tracks which users are online and who is currently typing in a conversation.
 * Each user can hold multiple socket connections (multiple tabs/devices).
 * A user is considered online as long as at least one socket remains connected.
 *
 * Conversation key for typing: sorted "[userA]:[userB]" — direction-agnostic.
 */

class PresenceService {
  constructor() {
    // userId → Set<socketId>
    this._connections = new Map();

    // conversationKey → Set<userId>
    this._typing = new Map();
  }

  // ─── Connections ──────────────────────────────────────────────────────────

  connect(userId, socketId) {
    if (!this._connections.has(userId)) {
      this._connections.set(userId, new Set());
    }
    this._connections.get(userId).add(socketId);
  }

  /**
   * Remove a socket. Returns true if this was the user's last connection
   * (i.e. the user just went offline).
   */
  disconnect(userId, socketId) {
    const sockets = this._connections.get(userId);
    if (!sockets) {
      return false;
    }
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this._connections.delete(userId);
      // Clean up any typing state left behind
      for (const [key, typingSet] of this._typing) {
        typingSet.delete(userId);
        if (typingSet.size === 0) {
          this._typing.delete(key);
        }
      }
      return true; // user went offline
    }
    return false;
  }

  isOnline(userId) {
    return this._connections.has(userId) && this._connections.get(userId).size > 0;
  }

  onlineUserIds() {
    return [...this._connections.keys()];
  }

  // ─── Typing ───────────────────────────────────────────────────────────────

  _convKey(userA, userB) {
    return [userA, userB].sort().join(':');
  }

  startTyping(userId, partnerId) {
    const key = this._convKey(userId, partnerId);
    if (!this._typing.has(key)) {
      this._typing.set(key, new Set());
    }
    this._typing.get(key).add(userId);
  }

  stopTyping(userId, partnerId) {
    const key = this._convKey(userId, partnerId);
    const set = this._typing.get(key);
    if (set) {
      set.delete(userId);
      if (set.size === 0) {
        this._typing.delete(key);
      }
    }
  }

  /**
   * Returns the set of userIds currently typing in a conversation,
   * excluding the querying user themselves.
   */
  whoIsTyping(userId, partnerId) {
    const key = this._convKey(userId, partnerId);
    const set = this._typing.get(key) || new Set();
    return [...set].filter((id) => id !== userId);
  }

  // ─── Test helpers ─────────────────────────────────────────────────────────

  _reset() {
    this._connections.clear();
    this._typing.clear();
  }
}

module.exports = new PresenceService();
