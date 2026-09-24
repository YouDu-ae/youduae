const mockCookieShow = jest.fn();
const mockBearerShow = jest.fn();

jest.mock('./sdk', () => ({
  getSdk: () => ({ currentUser: { show: (...args) => mockCookieShow(...args) } }),
}));

jest.mock('./mobileSdk', () => ({
  hasBearerToken: req => (req.headers.authorization || '').startsWith('Bearer '),
  userSdkFromBearer: () => ({ currentUser: { show: (...args) => mockBearerShow(...args) } }),
}));

const { requireUser } = require('./auth');

const userResponse = id => ({ data: { data: { id: { uuid: id } } } });

const run = async headers => {
  const req = { headers };
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  await requireUser(req, res, next);
  return { req, res, next };
};

describe('requireUser', () => {
  beforeEach(() => {
    mockCookieShow.mockReset();
    mockBearerShow.mockReset();
  });

  it('identifies the site user from the session cookie', async () => {
    mockCookieShow.mockResolvedValue(userResponse('web-user'));
    const { req, next } = await run({});
    expect(req.authUserId).toBe('web-user');
    expect(next).toHaveBeenCalled();
  });

  // The iOS app has no cookie and sends its Sharetribe token instead.
  it('identifies the app user from a Bearer token', async () => {
    mockBearerShow.mockResolvedValue(userResponse('app-user'));
    const { req, next } = await run({ authorization: 'Bearer token-1' });
    expect(req.authUserId).toBe('app-user');
    expect(mockCookieShow).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('answers 401 when Sharetribe does not accept the session', async () => {
    mockBearerShow.mockRejectedValue(new Error('invalid token'));
    const { res, next } = await run({ authorization: 'Bearer expired' });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
