const mockListingsShow = jest.fn();
const mockListingsUpdate = jest.fn();
const mockTransactionsQuery = jest.fn();
const mockNotifyCategory = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({
  createInstance: () => ({
    listings: {
      show: (...args) => mockListingsShow(...args),
      update: (...args) => mockListingsUpdate(...args),
    },
    transactions: {
      query: (...args) => mockTransactionsQuery(...args),
    },
  }),
}));

jest.mock('../api/telegram-bot', () => ({
  notifyNewListingToCategory: (...args) => mockNotifyCategory(...args),
  notifyAdminListingPendingApproval: jest.fn(),
}));

const { notifyExecutorsAboutReopenedListing } = require('./notifyListingPublished');

const ENV_KEYS = ['INTEGRATION_API_CLIENT_ID', 'INTEGRATION_API_CLIENT_SECRET'];
const savedEnv = {};

const listingIn = (state, metadata = {}) => ({
  data: {
    data: {
      attributes: {
        state,
        title: 'Заменить кнопку полотенцесушителя',
        price: { amount: 20000, currency: 'AED' },
        publicData: { categoryLevel1: 'repairs_main' },
        metadata,
      },
    },
  },
});

describe('notifyExecutorsAboutReopenedListing', () => {
  beforeAll(() => {
    ENV_KEYS.forEach(key => {
      savedEnv[key] = process.env[key];
      process.env[key] = 'test';
    });
  });

  afterAll(() => {
    ENV_KEYS.forEach(key => {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    });
  });

  beforeEach(() => {
    [mockListingsShow, mockListingsUpdate, mockTransactionsQuery, mockNotifyCategory].forEach(
      mock => mock.mockReset()
    );
    mockTransactionsQuery.mockResolvedValue({ data: { data: [] } });
    mockNotifyCategory.mockResolvedValue({ sent: 2, total: 2 });
  });

  // The first announcement set telegramNotifiedAt long ago; a change of
  // executor has to go out regardless.
  it('announces the task again, leaving out the people it must not reach', async () => {
    mockListingsShow.mockResolvedValue(
      listingIn('published', { telegramNotifiedAt: '2026-10-01T10:00:00.000Z' })
    );

    await notifyExecutorsAboutReopenedListing('task-1', { excludeUserIds: ['user-1', 'author-1'] });

    expect(mockNotifyCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'repairs_main',
        categoryName: 'Ремонт и строительство',
        listingTitle: 'Заменить кнопку полотенцесушителя',
        price: '200 AED',
        listingUrl: expect.stringMatching(/\/l\/task-1$/),
        reopened: true,
        excludeUserIds: ['user-1', 'author-1'],
      })
    );
    expect(mockListingsUpdate).not.toHaveBeenCalled();
  });

  it('leaves out the specialists whose offer on the task was declined', async () => {
    mockListingsShow.mockResolvedValue(listingIn('published'));
    mockTransactionsQuery.mockResolvedValue({
      data: {
        data: [{ relationships: { customer: { data: { id: { uuid: 'declined-1' } } } } }],
      },
    });

    await notifyExecutorsAboutReopenedListing('task-1', { excludeUserIds: ['user-1', 'author-1'] });

    expect(mockTransactionsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'task-1',
        lastTransitions: ['transition/decline-offer'],
      })
    );
    expect(mockNotifyCategory).toHaveBeenCalledWith(
      expect.objectContaining({ excludeUserIds: ['user-1', 'author-1', 'declined-1'] })
    );
  });

  it('still announces the task when the declined offers cannot be read', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockListingsShow.mockResolvedValue(listingIn('published'));
    mockTransactionsQuery.mockRejectedValue(new Error('timeout'));

    await notifyExecutorsAboutReopenedListing('task-1', { excludeUserIds: ['user-1'] });

    expect(mockNotifyCategory).toHaveBeenCalledWith(
      expect.objectContaining({ excludeUserIds: ['user-1'] })
    );
    consoleError.mockRestore();
  });

  it('stays silent about a task that is not back in search', async () => {
    mockListingsShow.mockResolvedValue(listingIn('closed'));

    const result = await notifyExecutorsAboutReopenedListing('task-1');

    expect(result).toEqual({ skipped: 'state-closed' });
    expect(mockNotifyCategory).not.toHaveBeenCalled();
    expect(mockTransactionsQuery).not.toHaveBeenCalled();
  });
});
