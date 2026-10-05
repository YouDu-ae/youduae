const mockQuery = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({ transactions: { query: (...args) => mockQuery(...args) } }),
}));

jest.mock('../api-util/sdk', () => ({ handleError: jest.fn() }));

const { previousMonthRange, pickTaskOfTheMonth } = require('./task-of-the-month');

const ref = (type, uuid) => ({ id: { uuid }, type });

const transaction = ({ id, completedAt, price, lastTransitionedAt, reviewIds = [] }) => ({
  id: { uuid: id },
  type: 'transaction',
  attributes: {
    lastTransition: 'transition/review-1-by-provider',
    lastTransitionedAt: new Date(lastTransitionedAt || completedAt),
    transitions: [
      { transition: 'transition/make-offer', createdAt: new Date('2026-08-01T10:00:00Z') },
      { transition: 'transition/complete', createdAt: new Date(completedAt) },
    ],
    protectedData: { offer: { price, currency: 'AED' } },
  },
  relationships: {
    listing: { data: ref('listing', `listing-${id}`) },
    customer: { data: ref('user', `specialist-${id}`) },
    reviews: { data: reviewIds.map(reviewId => ref('review', reviewId)) },
  },
});

const listing = (id, title) => ({
  id: { uuid: `listing-${id}` },
  type: 'listing',
  attributes: { title },
});

const user = (uuid, displayName, attributes = {}, profileImageId = null) => ({
  id: { uuid },
  type: 'user',
  attributes: { banned: false, deleted: false, profile: { displayName }, ...attributes },
  relationships: {
    profileImage: { data: profileImageId ? ref('image', profileImageId) : null },
  },
});

const review = (uuid, { type, state = 'public', authorId, rating = 5, content = 'Отлично' }) => ({
  id: { uuid },
  type: 'review',
  attributes: { type, state, rating, content, deleted: false },
  relationships: { author: { data: ref('user', authorId) } },
});

const completedTask = ({ id, title = `Task ${id}`, specialist = `Мастер ${id}`, ...rest }) => ({
  tx: transaction({ id, ...rest }),
  included: [listing(id, title), user(`specialist-${id}`, specialist)],
});

const SEPTEMBER = previousMonthRange(new Date('2026-10-05T18:42:00Z'));

const pick = (tasks, extraIncluded = []) =>
  pickTaskOfTheMonth(
    tasks.map(task => task.tx),
    [...tasks.flatMap(task => task.included), ...extraIncluded],
    SEPTEMBER
  );

describe('previousMonthRange', () => {
  it('takes the month before the current one in Dubai time', () => {
    expect(SEPTEMBER).toEqual({
      key: '2026-09',
      start: new Date('2026-08-31T20:00:00.000Z'),
      end: new Date('2026-09-30T20:00:00.000Z'),
    });
  });

  it('goes back to December of the previous year in January', () => {
    expect(previousMonthRange(new Date('2027-01-10T08:00:00Z'))).toEqual({
      key: '2026-12',
      start: new Date('2026-11-30T20:00:00.000Z'),
      end: new Date('2026-12-31T20:00:00.000Z'),
    });
  });

  it('switches at midnight in Dubai rather than in UTC', () => {
    expect(previousMonthRange(new Date('2026-10-31T19:59:00Z')).key).toBe('2026-09');
    expect(previousMonthRange(new Date('2026-10-31T20:00:00Z')).key).toBe('2026-10');
  });
});

describe('pickTaskOfTheMonth', () => {
  it('picks the largest task completed within the month', () => {
    const result = pick([
      completedTask({ id: 'small', price: 300, completedAt: '2026-09-10T10:00:00Z' }),
      completedTask({ id: 'big', price: 1200, completedAt: '2026-09-20T10:00:00Z' }),
      // Завершено в августе, отзыв оставили уже в сентябре
      completedTask({
        id: 'august',
        price: 5000,
        completedAt: '2026-08-28T10:00:00Z',
        lastTransitionedAt: '2026-09-03T10:00:00Z',
      }),
      // 1 октября в час ночи по Дубаю
      completedTask({ id: 'october', price: 9000, completedAt: '2026-09-30T21:00:00Z' }),
    ]);

    expect(result).toEqual({
      title: 'Task big',
      amountAED: 1200,
      completedAt: '2026-09-20T10:00:00.000Z',
      specialist: { id: 'specialist-big', displayName: 'Мастер big', avatarUrl: null },
      review: null,
    });
  });

  it('counts a task completed late on the last day in Dubai', () => {
    const result = pick([
      completedTask({ id: 'last-evening', price: 400, completedAt: '2026-09-30T19:30:00Z' }),
    ]);

    expect(result.title).toBe('Task last-evening');
  });

  it('skips tasks whose specialist profile is closed or whose listing is gone', () => {
    const banned = completedTask({
      id: 'banned',
      price: 2000,
      completedAt: '2026-09-15T10:00:00Z',
    });
    banned.included[1].attributes.banned = true;
    const deleted = completedTask({
      id: 'deleted',
      price: 3000,
      completedAt: '2026-09-16T10:00:00Z',
    });
    deleted.included[1] = user('specialist-deleted', '', { deleted: true });
    const noListing = completedTask({
      id: 'gone',
      price: 4000,
      completedAt: '2026-09-17T10:00:00Z',
    });
    noListing.included[0].attributes.title = null;

    const result = pick([
      banned,
      deleted,
      noListing,
      completedTask({ id: 'open', price: 500, completedAt: '2026-09-18T10:00:00Z' }),
    ]);

    expect(result.title).toBe('Task open');
  });

  it('prefers the more recent task when the amounts are equal', () => {
    const result = pick([
      completedTask({ id: 'earlier', price: 700, completedAt: '2026-09-05T10:00:00Z' }),
      completedTask({ id: 'later', price: 700, completedAt: '2026-09-25T10:00:00Z' }),
    ]);

    expect(result.title).toBe('Task later');
  });

  it("returns the client's published review of the specialist's work", () => {
    const task = completedTask({
      id: 'reviewed',
      price: 900,
      completedAt: '2026-09-12T10:00:00Z',
      reviewIds: ['about-client', 'about-specialist'],
    });

    const result = pick(
      [task],
      [
        review('about-client', { type: 'ofProvider', authorId: 'specialist-reviewed', rating: 3 }),
        review('about-specialist', {
          type: 'ofCustomer',
          authorId: 'client-1',
          content: 'Всё сделали аккуратно и вовремя',
        }),
        user('client-1', 'Анна К.'),
      ]
    );

    expect(result.review).toEqual({
      rating: 5,
      content: 'Всё сделали аккуратно и вовремя',
      authorName: 'Анна К.',
    });
  });

  it('leaves out a review that Sharetribe has not published yet', () => {
    const task = completedTask({
      id: 'pending',
      price: 900,
      completedAt: '2026-09-12T10:00:00Z',
      reviewIds: ['pending-review'],
    });

    const result = pick(
      [task],
      [review('pending-review', { type: 'ofCustomer', state: 'pending', authorId: 'client-1' })]
    );

    expect(result.review).toBeNull();
  });

  it("uses the specialist's square avatar", () => {
    const task = completedTask({ id: 'avatar', price: 900, completedAt: '2026-09-12T10:00:00Z' });
    task.included[1] = user('specialist-avatar', 'Мастер', {}, 'image-1');
    const image = {
      id: { uuid: 'image-1' },
      type: 'image',
      attributes: {
        variants: {
          'square-small': { url: 'https://img.example/240.jpg' },
          'square-small2x': { url: 'https://img.example/480.jpg' },
        },
      },
    };

    expect(pick([task], [image]).specialist.avatarUrl).toBe('https://img.example/480.jpg');
  });

  it('returns null when nothing was completed in the month', () => {
    expect(
      pick([completedTask({ id: 'august', price: 900, completedAt: '2026-08-12T10:00:00Z' })])
    ).toBeNull();
  });
});

describe('GET /api/task-of-the-month', () => {
  let handler;

  const call = async () => {
    const res = {};
    res.set = jest.fn(() => res);
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    await handler({}, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };

  beforeEach(() => {
    jest.resetModules();
    handler = require('./task-of-the-month');
    mockQuery.mockReset();
    process.env.INTEGRATION_API_CLIENT_ID = 'client-id';
    process.env.INTEGRATION_API_CLIENT_SECRET = 'client-secret';
  });

  afterAll(() => {
    delete process.env.INTEGRATION_API_CLIENT_ID;
    delete process.env.INTEGRATION_API_CLIENT_SECRET;
  });

  it('answers with the winner of the previous month and caches it', async () => {
    const range = previousMonthRange(new Date());
    const completedAt = new Date(range.start.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const task = completedTask({ id: 'winner', price: 1500, completedAt });
    mockQuery.mockResolvedValue({
      data: { data: [task.tx], included: task.included, meta: { totalPages: 1 } },
    });

    const first = await call();
    await call();

    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      month: range.key,
      task: expect.objectContaining({ title: 'Task winner', amountAED: 1500 }),
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        lastTransitions: expect.arrayContaining(['transition/complete']),
        createdAtEnd: range.end.toISOString(),
      })
    );
  });

  it('answers 500 without Integration API credentials', async () => {
    delete process.env.INTEGRATION_API_CLIENT_SECRET;

    const result = await call();

    expect(result.status).toBe(500);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
