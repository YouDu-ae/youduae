import { sendMessage } from './TransactionPage.duck';
import { markTransactionAsViewed } from '../../util/transactionNotifications';

jest.mock('../../util/transactionNotifications', () => ({
  markTransactionAsViewed: jest.fn(),
}));
jest.mock('../../analytics/plausibleEvents', () => ({
  trackMessageSent: jest.fn(),
  trackReviewSubmitted: jest.fn(),
}));

const config = { layout: { listingImage: { aspectWidth: 1, aspectHeight: 1 } } };
const getState = () => ({
  user: { currentUser: { id: { uuid: 'user-1' } } },
  TransactionPage: { totalMessages: 1 },
  marketplaceData: { entities: {} },
});
const send = (sdkSend, txId = { uuid: 'tx-1' }) => {
  const sdk = {
    messages: {
      send: sdkSend,
      query: jest.fn(() =>
        Promise.resolve({
          data: { data: [], included: [], meta: { totalItems: 1, totalPages: 1, page: 1 } },
        })
      ),
    },
  };
  const dispatch = action =>
    typeof action === 'function' ? action(dispatch, getState, sdk) : action;
  return sendMessage(txId, 'Здравствуйте', config)(dispatch, getState, sdk);
};

describe('sendMessage', () => {
  beforeEach(() => {
    markTransactionAsViewed.mockClear();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('marks the conversation read once the reply is sent', async () => {
    const messageId = await send(() => Promise.resolve({ data: { data: { id: 'msg-1' } } }));

    expect(messageId).toBe('msg-1');
    expect(markTransactionAsViewed).toHaveBeenCalledWith('tx-1', 'user-1');
  });

  it('leaves the conversation unread when the message was not sent', async () => {
    await expect(send(() => Promise.reject(new Error('network')))).rejects.toThrow('network');

    expect(markTransactionAsViewed).not.toHaveBeenCalled();
  });
});
