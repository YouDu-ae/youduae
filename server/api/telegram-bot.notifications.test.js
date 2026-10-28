const mockSubscribersByCategory = jest.fn();
const mockSubscriber = jest.fn();

jest.mock('sharetribe-flex-integration-sdk', () => ({ createInstance: () => ({}) }));
jest.mock('./seo-optimizer', () => ({ optimizeForSEO: jest.fn() }));
jest.mock('../api-util/portfolioModeration', () => ({}));
jest.mock('../db', () => ({
  getTelegramSubscribersByCategory: (...args) => mockSubscribersByCategory(...args),
  getTelegramSubscriber: (...args) => mockSubscriber(...args),
}));

const { notifyNewListingToCategory, notifyOtherExecutorChosen } = require('./telegram-bot');

const originalFetch = global.fetch;

// What went to Telegram, as [{ chatId, text }].
const sentMessages = () =>
  global.fetch.mock.calls.map(([, request]) => {
    const { chat_id: chatId, text } = JSON.parse(request.body);
    return { chatId, text };
  });

const task = overrides => ({
  categoryId: 'repairs_main',
  categoryName: 'Ремонт и строительство',
  listingTitle: 'Заменить кнопку полотенцесушителя',
  price: '200 AED',
  listingUrl: 'https://youdu.ae/l/task-1',
  listingId: 'task-1',
  ...overrides,
});

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true, result: {} }) }));
  mockSubscribersByCategory
    .mockReset()
    .mockResolvedValue([
      { userId: 'user-1', chatId: '101' },
      { userId: 'user-2', chatId: '102' },
      { userId: 'author-1', chatId: '103' },
    ]);
  mockSubscriber.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('notifyNewListingToCategory', () => {
  it('announces a task looking for an executor again, without the people left out', async () => {
    const result = await notifyNewListingToCategory(
      task({ reopened: true, excludeUserIds: ['user-1', 'author-1'] })
    );

    expect(result).toEqual({ sent: 1, total: 1 });
    const [message] = sentMessages();
    expect(message.chatId).toBe('102');
    expect(message.text).toContain('Задание снова ищет исполнителя');
    expect(message.text).toContain('Заменить кнопку полотенцесушителя');
    expect(message.text).toContain('https://youdu.ae/l/task-1');
  });

  it('still announces a new task to everyone in the category', async () => {
    const result = await notifyNewListingToCategory(task());

    expect(result).toEqual({ sent: 3, total: 3 });
    expect(sentMessages()[0].text).toContain('Новое задание!');
  });
});

describe('notifyOtherExecutorChosen', () => {
  it('tells the specialist the offer is kept for a change of executor', async () => {
    mockSubscriber.mockResolvedValue({ chat_id: '102', is_active: true });

    await notifyOtherExecutorChosen('user-2', { listingTitle: 'Собрать шкаф' });

    const [message] = sentMessages();
    expect(message.chatId).toBe('102');
    expect(message.text).toContain(
      'Заказчик выбрал другого исполнителя для задания "Собрать шкаф"'
    );
    expect(message.text).toContain('Ваш отклик сохранён');
    expect(message.text).not.toContain('Отклик отклонён');
  });
});
