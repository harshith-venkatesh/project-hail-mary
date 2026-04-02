const requestLogger = require('../../src/middlewares/requestLogger');

function buildReq(overrides = {}) {
  return { method: 'GET', originalUrl: '/api/test', ...overrides };
}

function buildRes(statusCode = 200) {
  const listeners = {};
  return {
    statusCode,
    on: (event, cb) => { listeners[event] = cb; },
    emit: (event) => listeners[event] && listeners[event](),
  };
}

describe('requestLogger middleware', () => {
  it('calls next()', () => {
    const next = jest.fn();
    requestLogger(buildReq(), buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('attaches a finish listener to the response', () => {
    const res = buildRes();
    const onSpy = jest.spyOn(res, 'on');
    requestLogger(buildReq(), res, jest.fn());
    expect(onSpy).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('does not throw when the finish event fires', () => {
    const res = buildRes(200);
    requestLogger(buildReq(), res, jest.fn());
    expect(() => res.emit('finish')).not.toThrow();
  });
});
