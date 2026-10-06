jest.mock('../api-util/portfolioModeration', () => ({
  notifyNewPhotos: jest.fn(),
}));

const { notifyNewPhotos } = require('../api-util/portfolioModeration');
const notifyPortfolioModeration = require('./notify-portfolio-moderation');

const SPECIALIST = '68b9a3a1-0000-4000-8000-000000000001';

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/notify-portfolio-moderation', () => {
  it('announces the photos of the signed-in specialist, whatever user the body names', async () => {
    notifyNewPhotos.mockResolvedValue({ sent: 2, total: 2 });
    const res = response();

    await notifyPortfolioModeration(
      { authUserId: SPECIALIST, body: { userId: 'someone-else', imageIds: ['a', 'b'] } },
      res
    );

    expect(notifyNewPhotos).toHaveBeenCalledWith(SPECIALIST, {
      imageIds: ['a', 'b'],
      photosCount: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, sent: 2 });
  });

  it('keeps only string ids and at most ten of them', async () => {
    notifyNewPhotos.mockResolvedValue({ sent: 0, total: 0 });
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);

    await notifyPortfolioModeration(
      { authUserId: SPECIALIST, body: { imageIds: [{ uuid: 'x' }, 7, ...ids] } },
      response()
    );

    expect(notifyNewPhotos.mock.calls[0][1].imageIds).toEqual(ids.slice(0, 10));
  });

  it('accepts the photo count sent by pages opened before the update', async () => {
    notifyNewPhotos.mockResolvedValue({ sent: 1, total: 1 });

    await notifyPortfolioModeration(
      { authUserId: SPECIALIST, body: { photosCount: 1 } },
      response()
    );

    expect(notifyNewPhotos).toHaveBeenCalledWith(SPECIALIST, {
      imageIds: undefined,
      photosCount: 1,
    });
  });

  it('answers 500 when the profile cannot be read', async () => {
    notifyNewPhotos.mockRejectedValue(
      Object.assign(new Error('Service Unavailable'), { status: 503 })
    );
    const res = response();

    await notifyPortfolioModeration({ authUserId: SPECIALIST, body: { imageIds: ['a'] } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
