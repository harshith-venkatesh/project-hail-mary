const userService = require('../services/UserService');

class UserController {
  async create(req, res, next) {
    try {
      const user = await userService.create(req.body);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async findAll(_req, res, next) {
    try {
      const users = await userService.findAll();
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  }

  async findById(req, res, next) {
    try {
      const user = await userService.findById(req.params.id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const user = await userService.update(req.params.id, req.body);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
