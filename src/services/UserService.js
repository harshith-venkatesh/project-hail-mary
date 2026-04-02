const createError = require('http-errors');
const User = require('../models/User');

// In-memory store — swap with a real DB repository without changing this interface.
const store = new Map();

class UserService {
  async create({ name, email }) {
    const existing = [...store.values()].find((u) => u.email === email.toLowerCase());
    if (existing) {
      throw createError(409, `User with email '${email}' already exists`);
    }

    const user = new User({ name, email });
    store.set(user.id, user);
    return user.toJSON();
  }

  async findById(id) {
    const user = store.get(id);
    if (!user) {
      throw createError(404, `User '${id}' not found`);
    }
    return user.toJSON();
  }

  async findAll() {
    return [...store.values()].map((u) => u.toJSON());
  }

  async update(id, updates) {
    const user = store.get(id);
    if (!user) {
      throw createError(404, `User '${id}' not found`);
    }

    if (updates.name !== undefined) {
      user.name = updates.name;
    }
    if (updates.email !== undefined) {
      const conflict = [...store.values()].find(
        (u) => u.email === updates.email.toLowerCase() && u.id !== id,
      );
      if (conflict) {
        throw createError(409, `Email '${updates.email}' is already taken`);
      }
      user.email = updates.email.toLowerCase();
    }

    user.updatedAt = new Date();
    return user.toJSON();
  }

  async delete(id) {
    if (!store.has(id)) {
      throw createError(404, `User '${id}' not found`);
    }
    store.delete(id);
  }

  // Exposed for test resets only
  _reset() {
    store.clear();
  }
}

module.exports = new UserService();
