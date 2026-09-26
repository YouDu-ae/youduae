import {
  hasUnreadUpdates,
  setViewedTransactionsCache,
  clearViewedTransactionsCache,
} from './transactionNotifications';

const tx = (uuid, lastTransitionedAt) => ({ id: { uuid }, attributes: { lastTransitionedAt } });

const VIEWED = Date.parse('2026-09-26T12:00:00Z');

describe('hasUnreadUpdates', () => {
  afterEach(() => clearViewedTransactionsCache());

  it('shows a reply that came after the last view, though the deal did not move', () => {
    setViewedTransactionsCache(
      { 'tx-1': VIEWED },
      { 'tx-1': Date.parse('2026-09-26T13:17:00Z') }
    );
    expect(hasUnreadUpdates(tx('tx-1', '2026-09-26T11:57:00Z'))).toBe(true);
  });

  it('stays read when the last reply was seen', () => {
    setViewedTransactionsCache(
      { 'tx-1': VIEWED },
      { 'tx-1': Date.parse('2026-09-26T11:59:00Z') }
    );
    expect(hasUnreadUpdates(tx('tx-1', '2026-09-26T11:57:00Z'))).toBe(false);
  });

  it('still shows a transition after the last view', () => {
    setViewedTransactionsCache({ 'tx-1': VIEWED }, {});
    expect(hasUnreadUpdates(tx('tx-1', '2026-09-26T12:30:00Z'))).toBe(true);
  });

  it('treats a deal never opened as unread', () => {
    setViewedTransactionsCache({}, {});
    expect(hasUnreadUpdates(tx('tx-2', '2026-09-26T11:57:00Z'))).toBe(true);
  });

  it('shows nothing before the read state has loaded', () => {
    expect(hasUnreadUpdates(tx('tx-1', '2026-09-26T12:30:00Z'))).toBe(false);
  });
});
