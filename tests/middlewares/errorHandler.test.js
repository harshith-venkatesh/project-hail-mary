const createError = require('http-errors');
const errorHandler = require('../../src/middlewares/errorHandler');

function buildReq() {
  return { method: 'GET', originalUrl: '/test' };
}

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  it('responds with the error status and message', () => {
    const err = createError(404, 'Not found');
    const res = buildRes();
    errorHandler(err, buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ status: 404, message: 'Not found' }) }),
    );
  });

  it('defaults to 500 for errors without a status', () => {
    const err = new Error('boom');
    const res = buildRes();
    errorHandler(err, buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('includes details when present on the error', () => {
    const err = createError(422, 'Validation failed');
    err.details = [{ field: 'email', message: 'invalid' }];
    const res = buildRes();
    errorHandler(err, buildReq(), res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(body.error.details).toEqual([{ field: 'email', message: 'invalid' }]);
  });
});
