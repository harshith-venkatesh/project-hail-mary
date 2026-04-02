/**
 * User model schema definition.
 * In a production system this maps to an ORM (Sequelize/Mongoose).
 * Indexes noted here should be applied at the DB layer.
 */

const { randomUUID } = require('crypto');

class User {
  /**
   * @param {object} data
   * @param {string} data.name
   * @param {string} data.email
   */
  constructor({ name, email }) {
    this.id = randomUUID();
    this.name = name;
    this.email = email.toLowerCase();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Schema definition with index hints.
 *
 * DB Indexes (apply at migration / schema level):
 *   - UNIQUE INDEX on email          → fast lookup on login / uniqueness check
 *   - INDEX on createdAt             → paginated user lists ordered by creation
 */
User.schema = {
  id: { type: 'uuid', primaryKey: true },
  name: { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true },
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' },
};

module.exports = User;
