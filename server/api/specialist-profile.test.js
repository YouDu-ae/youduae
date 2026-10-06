const mockShow = jest.fn();
const mockFetchReviewStats = jest.fn();
const mockFetchCompletedCount = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({ users: { show: (...args) => mockShow(...args) } }),
}));

jest.mock('sharetribe-flex-sdk', () => ({ createInstance: () => ({}) }));

jest.mock('../api-util/reputation', () => ({
  ...jest.requireActual('../api-util/reputation'),
  fetchReviewStats: (...args) => mockFetchReviewStats(...args),
  fetchCompletedCount: (...args) => mockFetchCompletedCount(...args),
}));

const specialistProfile = require('./specialist-profile');
const { approvedPortfolio, profileCache } = specialistProfile;

const USER_ID = '6a7c8e37-0000-4000-8000-000000000001';
const AVATAR_ID = 'aaaaaaaa-0000-4000-8000-000000000002';

const photo = (n, status = 'approved') => ({
  imageId: `image-${n}`,
  imageUrl: `https://sharetribe.imgix.net/photo-${n}.jpg`,
  status,
});

const showResponse = ({ attributes = {}, publicData = {}, withAvatar = true } = {}) => ({
  data: {
    data: {
      id: { uuid: USER_ID },
      type: 'user',
      attributes: {
        banned: false,
        deleted: false,
        email: 'master@example.com',
        createdAt: new Date('2025-11-16T09:00:00Z'),
        profile: {
          displayName: 'Мохамед Х',
          bio: 'Ремонт и отделка',
          publicData: { userType: 'customer', ...publicData },
          protectedData: { phoneNumber: '+971500000000' },
          privateData: { note: 'secret' },
          metadata: { isVerified: true },
        },
        ...attributes,
      },
      relationships: {
        profileImage: { data: withAvatar ? { id: { uuid: AVATAR_ID }, type: 'image' } : null },
      },
    },
    included: withAvatar
      ? [
          {
            id: { uuid: AVATAR_ID },
            type: 'image',
            attributes: {
              variants: {
                'square-small': { url: 'https://img/avatar-240.jpg' },
                'square-small2x': { url: 'https://img/avatar-480.jpg' },
              },
            },
          },
        ]
      : [],
  },
});

const request = userId => ({ query: { userId } });

const response = () => {
  const res = {};
  res.status = jest.fn(code => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn(body => {
    res.body = body;
    return res;
  });
  return res;
};

const call = async userId => {
  const res = response();
  await specialistProfile(request(userId), res);
  return res;
};

beforeEach(() => {
  profileCache.clear();
  mockShow.mockReset();
  mockFetchReviewStats.mockReset().mockResolvedValue({ count: 1, averageRating: 5 });
  mockFetchCompletedCount.mockReset().mockResolvedValue(4);
});

describe('GET /api/specialist-profile', () => {
  it('returns the public profile with the approved photos only', async () => {
    mockShow.mockResolvedValue(
      showResponse({
        publicData: {
          serviceCategories: ['repair', 'cleaning'],
          portfolio: [photo(1), photo(2, 'pending'), photo(3)],
        },
      })
    );

    const res = await call(USER_ID);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: {
        id: USER_ID,
        displayName: 'Мохамед Х',
        bio: 'Ремонт и отделка',
        avatarUrl: 'https://img/avatar-480.jpg',
        isVerified: true,
        rating: 5,
        reviewCount: 1,
        completedTasks: 4,
        categories: ['repair', 'cleaning'],
        memberSince: new Date('2025-11-16T09:00:00Z'),
        portfolio: [
          { id: 'image-1', url: 'https://sharetribe.imgix.net/photo-1.jpg' },
          { id: 'image-3', url: 'https://sharetribe.imgix.net/photo-3.jpg' },
        ],
      },
    });
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, include: ['profileImage'] })
    );
    expect(mockFetchReviewStats).toHaveBeenCalledWith(expect.anything(), {
      subjectId: USER_ID,
      role: 'specialist',
    });
  });

  it('copes with a profile that has no avatar, categories or portfolio', async () => {
    mockShow.mockResolvedValue(showResponse({ withAvatar: false }));

    const { body } = await call(USER_ID);

    expect(body.data).toMatchObject({ avatarUrl: null, categories: [], portfolio: [] });
  });

  it('answers 404 for an unknown, banned or deleted user', async () => {
    mockShow.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    expect((await call(USER_ID)).statusCode).toBe(404);

    profileCache.clear();
    mockShow.mockResolvedValueOnce(showResponse({ attributes: { banned: true } }));
    expect((await call(USER_ID)).statusCode).toBe(404);

    profileCache.clear();
    mockShow.mockResolvedValueOnce(showResponse({ attributes: { deleted: true } }));
    expect((await call(USER_ID)).statusCode).toBe(404);
  });

  it('rejects a missing or malformed userId without calling Sharetribe', async () => {
    expect((await call(undefined)).statusCode).toBe(400);
    expect((await call('not-a-uuid')).statusCode).toBe(400);
    expect((await call([USER_ID, USER_ID])).statusCode).toBe(400);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('answers 500 when Sharetribe fails', async () => {
    mockShow.mockRejectedValue(Object.assign(new Error('Too Many Requests'), { status: 429 }));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect((await call(USER_ID)).statusCode).toBe(500);

    console.error.mockRestore();
  });

  it('serves repeat requests for the same specialist from the cache', async () => {
    mockShow.mockResolvedValue(showResponse());

    await call(USER_ID);
    await call(USER_ID);

    expect(mockShow).toHaveBeenCalledTimes(1);
  });
});

describe('approvedPortfolio', () => {
  it('keeps at most five photos in their original order', () => {
    const portfolio = [1, 2, 3, 4, 5, 6, 7].map(n => photo(n));

    expect(approvedPortfolio(portfolio).map(item => item.id)).toEqual([
      'image-1',
      'image-2',
      'image-3',
      'image-4',
      'image-5',
    ]);
  });

  it('skips repeats and entries that cannot be shown', () => {
    const portfolio = [
      photo(1),
      photo(1),
      null,
      'https://sharetribe.imgix.net/bare.jpg',
      { ...photo(2), imageUrl: 'http://insecure.example.com/2.jpg' },
      { ...photo(3), imageUrl: undefined },
      { imageUrl: 'https://sharetribe.imgix.net/no-id.jpg', status: 'approved' },
    ];

    expect(approvedPortfolio(portfolio)).toEqual([
      { id: 'image-1', url: 'https://sharetribe.imgix.net/photo-1.jpg' },
      {
        id: 'https://sharetribe.imgix.net/no-id.jpg',
        url: 'https://sharetribe.imgix.net/no-id.jpg',
      },
    ]);
  });

  it('returns nothing when the portfolio is absent or not a list', () => {
    expect(approvedPortfolio(undefined)).toEqual([]);
    expect(approvedPortfolio({ 0: photo(1) })).toEqual([]);
  });
});
