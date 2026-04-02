const { body } = require('express-validator');
const validate = require('../../src/middlewares/validate');

function buildReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function buildRes() {
  return {};
}

describe('validate middleware', () => {
  it('calls next() with no arguments when validation passes', async () => {
    const chain = [body('name').notEmpty()];
    const req = buildReq({ body: { name: 'Alice' } });

    // Run the express-validator chain manually
    for (const c of chain) {
      await c.run(req);
    }

    const next = jest.fn();
    validate(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() with a 422 error when validation fails', async () => {
    const chain = [body('name').notEmpty().withMessage('name is required')];
    const req = buildReq({ body: {} });

    for (const c of chain) {
      await c.run(req);
    }

    const next = jest.fn();
    validate(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(422);
    expect(err.details).toEqual([{ field: 'name', message: 'name is required' }]);
  });
});
