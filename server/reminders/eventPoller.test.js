const mockMessages = jest.fn();
const mockApprovals = jest.fn();

jest.mock('../db', () => ({}));
jest.mock('../api-util/notifyListingPublished', () => ({ notifyExecutorsAboutListing: jest.fn() }));
jest.mock('../api-util/accountEmails', () => ({ sendAccountEmail: jest.fn() }));
jest.mock('./context', () => ({ createIntegrationSdk: () => ({}) }));
jest.mock('./messageNotifications', () => ({
  processMessageEvents: (...args) => mockMessages(...args),
}));
jest.mock('./listingApprovals', () => ({
  processApprovalEvents: (...args) => mockApprovals(...args),
}));
jest.mock('./accountDeletions', () => ({
  processDeletionEvents: async () => ({ events: 0, fullPage: false }),
}));
jest.mock('./eventArchive', () => ({
  processArchiveEvents: async () => ({ archived: 0, fullPage: false }),
}));
jest.mock('./listingCompletions', () => ({
  processCompletionEvents: async () => ({ completions: 0, fullPage: false }),
}));

const { setImmediate: realSetImmediate } = jest.requireActual('timers');
const { startEventPoller, stopEventPoller } = require('./eventPoller');

const advance = async ms => {
  jest.advanceTimersByTime(ms);
  await new Promise(resolve => realSetImmediate(resolve));
};

describe('startEventPoller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockMessages.mockReset().mockResolvedValue({ notified: 0, failed: 0, fullPage: false });
    mockApprovals.mockReset().mockResolvedValue({ approvals: 0, fullPage: false });
  });

  afterEach(() => {
    stopEventPoller();
    jest.useRealTimers();
    console.log.mockRestore();
  });

  it('reads chat messages every 15 seconds and the rest once a minute', async () => {
    startEventPoller();

    await advance(20 * 1000);
    expect(mockMessages).toHaveBeenCalledTimes(1);
    expect(mockApprovals).toHaveBeenCalledTimes(1);

    for (let step = 0; step < 4; step++) {
      await advance(15 * 1000);
    }
    expect(mockMessages).toHaveBeenCalledTimes(5);
    expect(mockApprovals).toHaveBeenCalledTimes(2);
  });

  it('keeps reading chat messages while the minute loop is busy', async () => {
    let finishApprovals;
    mockApprovals.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishApprovals = () => resolve({ approvals: 0, fullPage: false });
        })
    );
    startEventPoller();

    await advance(20 * 1000);
    await advance(15 * 1000);
    await advance(15 * 1000);

    expect(mockMessages).toHaveBeenCalledTimes(3);
    finishApprovals();
  });
});
