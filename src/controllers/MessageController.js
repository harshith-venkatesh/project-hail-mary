const messageService = require('../services/MessageService');

class MessageController {
  async send(req, res, next) {
    try {
      const msg = await messageService.send(req.body);
      res.status(201).json({ data: msg });
    } catch (err) {
      next(err);
    }
  }

  async findById(req, res, next) {
    try {
      const msg = await messageService.findById(req.params.id);
      res.json({ data: msg });
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req, res, next) {
    try {
      const { userA, userB } = req.params;
      const { limit, before } = req.query;
      const messages = await messageService.getConversation(userA, userB, {
        limit: limit ? parseInt(limit, 10) : undefined,
        before,
      });
      res.json({ data: messages });
    } catch (err) {
      next(err);
    }
  }

  async countUnread(req, res, next) {
    try {
      const count = await messageService.countUnread(req.params.receiverId);
      res.json({ data: { count } });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const msg = await messageService.updateStatus(req.params.id, req.body.status);
      res.json({ data: msg });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MessageController();
