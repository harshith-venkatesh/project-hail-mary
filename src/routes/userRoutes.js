const { Router } = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/UserController');
const validate = require('../middlewares/validate');

const router = Router();

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
    validate,
  ],
  userController.create.bind(userController),
);

router.get('/', userController.findAll.bind(userController));

router.get(
  '/:id',
  [uuidParam('id'), validate],
  userController.findById.bind(userController),
);

router.patch(
  '/:id',
  [
    uuidParam('id'),
    body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
    body('email').optional().isEmail().withMessage('valid email is required').normalizeEmail(),
    validate,
  ],
  userController.update.bind(userController),
);

router.delete(
  '/:id',
  [uuidParam('id'), validate],
  userController.delete.bind(userController),
);

module.exports = router;
