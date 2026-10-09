import reducer, {
  downloadFile,
  fetchMoreMessages,
  sendMessage,
  UPDATE_MESSAGE_FILES,
} from './TransactionPage.duck';
import { markTransactionAsViewed } from '../../util/transactionNotifications';
import { types as sdkTypes } from '../../util/sdkLoader';

jest.mock('../../util/transactionNotifications', () => ({
  markTransactionAsViewed: jest.fn(),
}));
jest.mock('../../analytics/plausibleEvents', () => ({
  trackMessageSent: jest.fn(),
  trackReviewSubmitted: jest.fn(),
}));
jest.mock('../../util/log');

const { UUID } = sdkTypes;

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

// A messages/query response with one message and a file in each of the given states
const messageWithFilesResponse = (messageId, fileStates) => {
  const attachments = fileStates.map((state, i) => ({
    id: new UUID(`att-${i}`),
    type: 'fileAttachment',
    attributes: { scope: 'public', deleted: false },
    relationships: { file: { data: { id: new UUID(`file-${i}`), type: 'file' } } },
  }));
  const files = fileStates.map((state, i) => ({
    id: new UUID(`file-${i}`),
    type: 'file',
    attributes: { name: `estimate-${i}.pdf`, size: 1000, state, deleted: false },
  }));
  return {
    data: {
      data: [
        {
          id: new UUID(messageId),
          type: 'message',
          attributes: { content: 'Смета', createdAt: new Date(), deleted: false },
          relationships: {
            publicFileAttachments: { data: attachments.map(({ id, type }) => ({ id, type })) },
          },
        },
      ],
      included: [...attachments, ...files],
      meta: { totalItems: 1, totalPages: 1, page: 1 },
    },
  };
};

describe('message files', () => {
  it('fetches messages with their files and follows the security scan until it is done', async () => {
    const txId = new UUID('tx-files');
    const query = jest
      .fn()
      .mockResolvedValueOnce(messageWithFilesResponse('msg-1', ['pendingVerification']))
      .mockResolvedValueOnce(messageWithFilesResponse('msg-1', ['available']));
    const sdk = { messages: { query } };
    const state = {
      TransactionPage: {
        transactionRef: { id: txId, type: 'transaction' },
        oldestMessagePageFetched: 0,
        totalMessagePages: 0,
        totalMessages: 0,
      },
    };
    const actions = [];
    const dispatch = action => {
      if (typeof action === 'function') {
        return action(dispatch, () => state, sdk);
      }
      actions.push(action);
      return action;
    };

    await dispatch(fetchMoreMessages(txId, config));

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_id: txId,
        include: [
          'sender',
          'sender.profileImage',
          'publicFileAttachments',
          'publicFileAttachments.file',
        ],
      })
    );

    // The scan result is checked a second later
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith({
      transaction_id: txId,
      ids: [new UUID('msg-1')],
      include: ['publicFileAttachments', 'publicFileAttachments.file'],
    });
    const update = actions.find(a => a.type === UPDATE_MESSAGE_FILES);
    expect(update.payload.publicFileAttachments[0].file.attributes.state).toBe('available');
  });

  it('replaces the files of the scanned message only', () => {
    const scanned = {
      id: { uuid: 'msg-1' },
      attributes: { content: 'Смета' },
      sender: { id: { uuid: 'user-2' } },
      publicFileAttachments: [{ file: { attributes: { state: 'pendingVerification' } } }],
    };
    const other = { id: { uuid: 'msg-2' }, attributes: { content: 'Привет' } };
    const updatedFiles = [{ file: { attributes: { state: 'available' } } }];

    const state = reducer(
      { messages: [scanned, other] },
      {
        type: UPDATE_MESSAGE_FILES,
        payload: { id: { uuid: 'msg-1' }, publicFileAttachments: updatedFiles },
      }
    );

    expect(state.messages[0]).toEqual({ ...scanned, publicFileAttachments: updatedFiles });
    expect(state.messages[1]).toBe(other);
  });
});

describe('downloadFile', () => {
  const fileAttachmentId = new UUID('att-1');
  let openWindow;

  beforeEach(() => {
    openWindow = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openWindow.mockRestore();
  });

  const download = create => {
    const actions = [];
    const dispatch = action => {
      actions.push(action);
      return action;
    };
    return downloadFile(fileAttachmentId)(dispatch, getState, { fileDownloads: { create } }).then(
      () => actions.reduce(reducer, undefined)
    );
  };

  it('opens the temporary file URL and keeps it for the fallback link', async () => {
    const url = 'https://files.test/estimate.pdf';
    const create = jest.fn(() => Promise.resolve({ data: { data: { attributes: { url } } } }));

    const state = await download(create);

    expect(create).toHaveBeenCalledWith({ fileAttachmentId });
    expect(openWindow).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    expect(state.fileDownloads['att-1']).toEqual({
      inProgress: false,
      error: null,
      downloadUrl: url,
    });
  });

  it('keeps the error when the file URL could not be fetched', async () => {
    const state = await download(jest.fn(() => Promise.reject(new Error('rate limited'))));

    expect(openWindow).not.toHaveBeenCalled();
    expect(state.fileDownloads['att-1']).toMatchObject({ inProgress: false, downloadUrl: null });
    expect(state.fileDownloads['att-1'].error).toBeTruthy();
  });
});
