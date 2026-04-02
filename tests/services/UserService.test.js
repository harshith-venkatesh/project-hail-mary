const userService = require('../../src/services/UserService');

beforeEach(() => userService._reset());

describe('UserService', () => {
  describe('create', () => {
    it('creates a user and returns it', async () => {
      const user = await userService.create({ name: 'Alice', email: 'alice@example.com' });
      expect(user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('normalises email to lowercase', async () => {
      const user = await userService.create({ name: 'Bob', email: 'BOB@EXAMPLE.COM' });
      expect(user.email).toBe('bob@example.com');
    });

    it('throws 409 when email is already taken', async () => {
      await userService.create({ name: 'Alice', email: 'alice@example.com' });
      await expect(userService.create({ name: 'Alice2', email: 'alice@example.com' })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const created = await userService.create({ name: 'Charlie', email: 'c@example.com' });
      const found = await userService.findById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws 404 when user does not exist', async () => {
      await expect(userService.findById('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('findAll', () => {
    it('returns an empty array when no users exist', async () => {
      expect(await userService.findAll()).toEqual([]);
    });

    it('returns all created users', async () => {
      await userService.create({ name: 'A', email: 'a@x.com' });
      await userService.create({ name: 'B', email: 'b@x.com' });
      expect(await userService.findAll()).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates name', async () => {
      const user = await userService.create({ name: 'Old', email: 'u@x.com' });
      const updated = await userService.update(user.id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('throws 409 when updated email conflicts', async () => {
      const u1 = await userService.create({ name: 'U1', email: 'u1@x.com' });
      await userService.create({ name: 'U2', email: 'u2@x.com' });
      await expect(userService.update(u1.id, { email: 'u2@x.com' })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('throws 404 for unknown id', async () => {
      await expect(
        userService.update('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('delete', () => {
    it('deletes an existing user', async () => {
      const user = await userService.create({ name: 'D', email: 'd@x.com' });
      await userService.delete(user.id);
      expect(await userService.findAll()).toHaveLength(0);
    });

    it('throws 404 for unknown id', async () => {
      await expect(
        userService.delete('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
