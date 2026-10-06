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

const photo = (n, status = 'pending') => ({
  imageId: `image-${n}`,
  imageUrl: `https://sharetribe.imgix.net/photo-${n}.jpg`,
  status,
});

const approval = item => ({ imageId: item.imageId, imageUrl: item.imageUrl });

const showResponse = ({
  attributes = {},
  publicData = {},
  approved = [],
  withAvatar = true,
} = {}) => ({
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
          metadata: { isVerified: true, approvedPortfolio: approved.map(approval) },
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
          portfolio: [photo(1), photo(2), photo(3)],
        },
        approved: [photo(1), photo(3)],
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
  const profileWith = (portfolio, approved = []) => ({
    publicData: { portfolio },
    metadata: { approvedPortfolio: approved },
  });

  it('keeps at most five photos in the order the specialist chose', () => {
    const photos = [1, 2, 3, 4, 5, 6, 7].map(n => photo(n));

    expect(
      approvedPortfolio(profileWith(photos, [...photos].reverse().map(approval))).map(
        item => item.id
      )
    ).toEqual(['image-1', 'image-2', 'image-3', 'image-4', 'image-5']);
  });

  it('ignores a status the specialist set in their own data', () => {
    expect(approvedPortfolio(profileWith([photo(1, 'approved')]))).toEqual([]);
  });

  it('shows a photo from the address the moderator approved', () => {
    const swapped = { ...photo(1), imageUrl: 'https://sharetribe.imgix.net/other.jpg' };

    expect(approvedPortfolio(profileWith([swapped], [approval(photo(1))]))).toEqual([
      { id: 'image-1', url: 'https://sharetribe.imgix.net/photo-1.jpg' },
    ]);
  });

  it('hides an approved photo the specialist has removed', () => {
    expect(approvedPortfolio(profileWith([photo(2)], [approval(photo(1))]))).toEqual([]);
  });

  it('skips repeats and photos kept outside Sharetribe', () => {
    const noId = { imageUrl: 'https://sharetribe.imgix.net/no-id.jpg' };
    const outside = { imageId: 'image-4', imageUrl: 'https://example.com/4.jpg' };
    const portfolio = [
      photo(1),
      photo(1),
      null,
      'https://sharetribe.imgix.net/bare.jpg',
      outside,
      noId,
    ];

    expect(approvedPortfolio(profileWith(portfolio, [approval(photo(1)), outside, noId]))).toEqual([
      { id: 'image-1', url: 'https://sharetribe.imgix.net/photo-1.jpg' },
      { id: noId.imageUrl, url: noId.imageUrl },
    ]);
  });

  it('returns nothing when the lists are absent or not lists', () => {
    expect(approvedPortfolio(undefined)).toEqual([]);
    expect(approvedPortfolio(profileWith({ 0: photo(1) }, [approval(photo(1))]))).toEqual([]);
    expect(approvedPortfolio(profileWith([photo(1)], { 0: approval(photo(1)) }))).toEqual([]);
  });
});
