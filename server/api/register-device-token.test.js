jest.mock('../db', () => ({
  registerDeviceToken: jest.fn(async () => {}),
  unregisterDeviceToken: jest.fn(async () => {}),
}));

const db = require('../db');
const registerDeviceToken = require('./register-device-token');

const call = async (body, authUserId = null) => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  await registerDeviceToken({ body, authUserId }, res);
  return res;
};

describe('POST /api/register-device-token', () => {
  beforeEach(() => {
    db.registerDeviceToken.mockClear();
    db.unregisterDeviceToken.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('binds the token to the signed-in account', async () => {
    const res = await call({ token: 'fcm-1', platform: 'ios' }, 'user-1');

    expect(db.registerDeviceToken).toHaveBeenCalledWith({
      userId: 'user-1',
      token: 'fcm-1',
      platform: 'ios',
      badge: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("lets a build that reports reads follow the server's unread badge", async () => {
    await call({ token: 'fcm-1', platform: 'ios', badge: true }, 'user-1');

    expect(db.registerDeviceToken).toHaveBeenCalledWith(expect.objectContaining({ badge: true }));
  });

  it('refuses to bind a token without a sign-in', async () => {
    const res = await call({ token: 'fcm-1', platform: 'ios' });

    expect(db.registerDeviceToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('drops the token on sign-out even when the session has already expired', async () => {
    const res = await call({ token: 'fcm-1', platform: 'ios', unregister: true });

    expect(db.unregisterDeviceToken).toHaveBeenCalledWith('fcm-1');
    expect(db.registerDeviceToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a request without a token', async () => {
    const res = await call({ platform: 'ios' }, 'user-1');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.registerDeviceToken).not.toHaveBeenCalled();
  });
});
