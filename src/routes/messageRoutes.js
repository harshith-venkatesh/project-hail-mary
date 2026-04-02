const { Router } = require('express');
const { body, param, query } = require('express-validator');
const messageController = require('../controllers/MessageController');
const validate = require('../middlewares/validate');
const Message = require('../models/Message');

const router = Router();

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

router.post(
  '/',
  [
    body('senderId').isUUID().withMessage('senderId must be a valid UUID'),
    body('receiverId').isUUID().withMessage('receiverId must be a valid UUID'),
    body('content').trim().notEmpty().withMessage('content is required'),
    validate,
  ],
  messageController.send.bind(messageController),
);

// Specific named routes must be registered before /:id to avoid shadowing
router.get(
  '/conversation/:userA/:userB',
  [
    uuidParam('userA'),
    uuidParam('userB'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1–200'),
    query('before').optional().isISO8601().withMessage('before must be an ISO-8601 date'),
    validate,
  ],
  messageController.getConversation.bind(messageController),
);

router.get(
  '/unread/:receiverId',
  [uuidParam('receiverId'), validate],
  messageController.countUnread.bind(messageController),
);

router.get(
  '/:id',
  [uuidParam('id'), validate],
  messageController.findById.bind(messageController),
);

router.patch(
  '/:id/status',
  [
    uuidParam('id'),
    body('status')
      .isIn(Object.values(Message.STATUS))
      .withMessage(`status must be one of: ${Object.values(Message.STATUS).join(', ')}`),
    validate,
  ],
  messageController.updateStatus.bind(messageController),
);

module.exports = router;
