import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import {
  fakeIntl,
  createUser,
  createCurrentUser,
  createMessage,
  createListing,
  createTransaction,
} from '../../../util/testData';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { TX_TRANSITION_ACTOR_CUSTOMER, getProcess } from '../../../transactions/transaction';

import { ActivityFeed } from './ActivityFeed';

const processTransitions = getProcess('default-purchase')?.transitions;

const { UUID } = sdkTypes;
const { screen, within, userEvent } = testingLibrary;
const noop = () => null;

export const createTxTransition = options => {
  return {
    createdAt: new Date(Date.UTC(2023, 4, 1)),
    by: TX_TRANSITION_ACTOR_CUSTOMER,
    transition: processTransitions.REQUEST_PAYMENT,
    ...options,
  };
};

describe('ActivityFeed', () => {
  it('verify that messages and relevant transition are shown', () => {
    const customer = createUser('user1');
    const provider = createUser('user2');
    const listing = createListing('listing');
    const props = {
      messages: [
        createMessage(
          'msg1',
          { content: 'message 1', createdAt: new Date(Date.UTC(2023, 10, 9, 8, 12)) },
          { sender: customer }
        ),
        createMessage(
          'msg2',
          { content: 'message 2', createdAt: new Date(Date.UTC(2023, 10, 10, 8, 12)) },
          { sender: provider }
        ),
      ],
      transaction: createTransaction({
        id: 'tx1',
        customer,
        provider,
        listing,
        lastTransitionedAt: new Date(Date.UTC(2023, 4, 1)),
        transitions: [
          createTxTransition({
            createdAt: new Date(Date.UTC(2023, 4, 1)),
            by: TX_TRANSITION_ACTOR_CUSTOMER,
            transition: processTransitions.REQUEST_PAYMENT,
          }),
          createTxTransition({
            createdAt: new Date(Date.UTC(2023, 4, 1, 0, 0, 1)),
            by: TX_TRANSITION_ACTOR_CUSTOMER,
            transition: processTransitions.CONFIRM_PAYMENT,
          }),
        ],
      }),
      stateData: {
        processName: 'default-purchase',
        processState: 'inquiry',
      },
      currentUser: createCurrentUser('user2'),
      hasOlderMessages: false,
      fetchMessagesInProgress: false,
      onOpenReviewModal: noop,
      onShowOlderMessages: noop,
      intl: fakeIntl,
    };

    render(<ActivityFeed {...props} />);

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const fragment = within(list);
    const items = fragment.getAllByRole('listitem');
    // 1 transition and 2 messages
    expect(items.length).toBe(3);

    // Find processTransitions.CONFIRM_PAYMENT
    // The first relevant transition in the process
    const firstLI = within(items[0]);
    expect(
      firstLI.getByText('TransactionPage.ActivityFeed.default-purchase.purchased')
    ).toBeInTheDocument();
    expect(firstLI.getByText('2023-05-01')).toBeInTheDocument();

    // Find first message
    const firstMsg = within(items[1]);
    expect(firstMsg.getByText('message 1')).toBeInTheDocument();
    expect(firstMsg.getByText('2023-11-09')).toBeInTheDocument();

    // Find first message
    const secondMsg = within(items[2]);
    expect(secondMsg.getByText('message 2')).toBeInTheDocument();
    expect(secondMsg.getByText('2023-11-10')).toBeInTheDocument();
  });

  it('shows the specialist offer comment as a chat message for both parties', () => {
    const customer = createUser('specialist');
    const provider = createUser('task-author');
    const listing = createListing('listing');
    const inquireAt = new Date(Date.UTC(2023, 4, 1, 11, 14));
    const transaction = createTransaction({
      id: 'tx-offer-comment',
      processName: 'assignment-flow-v3',
      lastTransition: 'transition/inquire',
      customer,
      provider,
      listing,
      lastTransitionedAt: inquireAt,
      transitions: [
        {
          createdAt: inquireAt,
          by: TX_TRANSITION_ACTOR_CUSTOMER,
          transition: 'transition/inquire',
        },
      ],
    });
    transaction.attributes.protectedData = {
      offer: {
        price: 500,
        currency: 'AED',
        comment: 'Добрый день пишу по поводу столешницы',
      },
    };

    const props = {
      messages: [],
      transaction,
      stateData: {
        processName: 'assignment-flow-v3',
        processState: 'inquiry',
      },
      currentUser: createCurrentUser('task-author'),
      hasOlderMessages: false,
      fetchMessagesInProgress: false,
      onOpenReviewModal: noop,
      onShowOlderMessages: noop,
      intl: fakeIntl,
    };

    render(<ActivityFeed {...props} />);

    expect(screen.getByText('Добрый день пишу по поводу столешницы')).toBeInTheDocument();
  });

  it('does not duplicate the offer comment when it is already a real message', () => {
    const customer = createUser('specialist');
    const provider = createUser('task-author');
    const listing = createListing('listing');
    const inquireAt = new Date(Date.UTC(2023, 4, 1, 11, 14));
    const transaction = createTransaction({
      id: 'tx-offer-comment-dup',
      processName: 'assignment-flow-v3',
      lastTransition: 'transition/inquire',
      customer,
      provider,
      listing,
      lastTransitionedAt: inquireAt,
      transitions: [
        {
          createdAt: inquireAt,
          by: TX_TRANSITION_ACTOR_CUSTOMER,
          transition: 'transition/inquire',
        },
      ],
    });
    transaction.attributes.protectedData = {
      offer: { comment: 'Добрый день пишу по поводу столешницы' },
    };

    render(
      <ActivityFeed
        messages={[
          createMessage(
            'msg-offer',
            { content: 'Добрый день пишу по поводу столешницы', createdAt: inquireAt },
            { sender: customer }
          ),
        ]}
        transaction={transaction}
        stateData={{
          processName: 'assignment-flow-v3',
          processState: 'inquiry',
        }}
        currentUser={createCurrentUser('task-author')}
        hasOlderMessages={false}
        fetchMessagesInProgress={false}
        onOpenReviewModal={noop}
        onShowOlderMessages={noop}
        intl={fakeIntl}
      />
    );

    expect(screen.getAllByText('Добрый день пишу по поводу столешницы')).toHaveLength(1);
  });
});

describe('ActivityFeed file attachments', () => {
  const customer = createUser('specialist');
  const provider = createUser('task-author');
  const transaction = createTransaction({
    id: 'tx-files',
    customer,
    provider,
    listing: createListing('listing'),
    transitions: [],
  });

  const createFileAttachment = (id, fileAttributes = {}) => ({
    id: new UUID(id),
    type: 'fileAttachment',
    attributes: { scope: 'public', deleted: false },
    file: {
      id: new UUID(`file-${id}`),
      type: 'file',
      attributes: {
        name: 'estimate.pdf',
        size: 250000,
        state: 'available',
        deleted: false,
        ...fileAttributes,
      },
    },
  });

  const messageWithFiles = (id, sender, content, fileAttachments) =>
    createMessage(
      id,
      { content, createdAt: new Date(Date.UTC(2023, 10, 9, 8, 12)) },
      { sender, publicFileAttachments: fileAttachments }
    );

  const renderFeed = (messages, props = {}) =>
    render(
      <ActivityFeed
        messages={messages}
        transaction={transaction}
        stateData={{ processName: 'default-purchase', processState: 'inquiry' }}
        currentUser={createCurrentUser('task-author')}
        hasOlderMessages={false}
        fetchMessagesInProgress={false}
        onOpenReviewModal={noop}
        onShowOlderMessages={noop}
        onDownloadFile={noop}
        marketplaceName="YouDu"
        intl={fakeIntl}
        {...props}
      />
    );

  it('shows the file of the other party and downloads it on click', async () => {
    const onDownloadFile = jest.fn();
    const fileAttachment = createFileAttachment('att-1');
    renderFeed([messageWithFiles('msg-1', customer, 'Смета во вложении', [fileAttachment])], {
      onDownloadFile,
    });

    expect(screen.getByText('Смета во вложении')).toBeInTheDocument();
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText('.pdf')).toBeInTheDocument();
    expect(screen.getByText(/^250\s?kB$/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'FileAttachments.downloadFile' }));
    expect(onDownloadFile).toHaveBeenCalledWith(fileAttachment.id);
  });

  it('offers a link when the browser did not open the file, and tells when fetching it failed', () => {
    const opened = createFileAttachment('att-opened', { name: 'photo.jpg' });
    const failed = createFileAttachment('att-failed', { name: 'plan.png' });
    renderFeed([messageWithFiles('msg-1', customer, 'Фото', [opened, failed])], {
      fileDownloads: {
        'att-opened': { inProgress: false, error: null, downloadUrl: 'https://files.test/photo' },
        'att-failed': { inProgress: false, error: { status: 500 }, downloadUrl: null },
      },
    });

    expect(screen.getByText('FileAttachments.downloadFileFallback')).toBeInTheDocument();
    expect(screen.getByText('FileAttachments.downloadFileFailed')).toBeInTheDocument();
  });

  it('hides messages of the other party until their files have passed the security scan', () => {
    renderFeed([
      messageWithFiles('msg-pending', customer, 'Проверяется', [
        createFileAttachment('att-pending', { state: 'pendingVerification' }),
      ]),
      messageWithFiles('msg-failed', customer, 'Не прошло', [
        createFileAttachment('att-failed', { state: 'verificationFailed' }),
      ]),
      messageWithFiles('msg-text', customer, 'Обычное сообщение', undefined),
    ]);

    expect(screen.getByText('Обычное сообщение')).toBeInTheDocument();
    expect(screen.queryByText('Проверяется')).not.toBeInTheDocument();
    expect(screen.queryByText('Не прошло')).not.toBeInTheDocument();
  });

  it('tells the sender that the message waits for the security scan or was not sent', () => {
    renderFeed([
      messageWithFiles('msg-pending', provider, 'Проверяется', [
        createFileAttachment('att-pending', { state: 'pendingVerification' }),
      ]),
      messageWithFiles('msg-failed', provider, 'Не прошло', [
        createFileAttachment('att-failed', { state: 'verificationFailed' }),
      ]),
    ]);

    expect(screen.getByText('Проверяется')).toBeInTheDocument();
    expect(screen.getByText('FileAttachments.fileVerifying')).toBeInTheDocument();
    expect(screen.getByText('Message.pendingVerificationNote')).toBeInTheDocument();
    expect(screen.getByText('Не прошло')).toBeInTheDocument();
    expect(screen.getByText('FileAttachments.fileSecurityCheckFailed')).toBeInTheDocument();
    expect(screen.getByText('Message.securityCheckFailedNote')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows deleted files and the notice when the marketplace has disabled files', () => {
    const { unmount } = renderFeed([
      messageWithFiles('msg-1', customer, 'Удалённый файл', [
        createFileAttachment('att-deleted', { deleted: true }),
      ]),
    ]);
    expect(screen.getByText('FileAttachments.fileDeleted')).toBeInTheDocument();
    unmount();

    renderFeed([messageWithFiles('msg-2', customer, 'Смета', [createFileAttachment('att-2')])], {
      allowFiles: false,
    });
    expect(screen.getByText('TransactionPage.messageFilesDisabled')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
