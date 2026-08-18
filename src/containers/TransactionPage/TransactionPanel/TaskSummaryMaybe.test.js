import { listingTaskStatus } from './TaskSummaryMaybe';

describe('listingTaskStatus', () => {
  it('treats a published listing without flags as open', () => {
    expect(listingTaskStatus({ attributes: { state: 'published', publicData: {} } })).toBe('open');
  });

  it('reads hired and in-progress as inProgress', () => {
    expect(
      listingTaskStatus({ attributes: { publicData: { hired: true } } })
    ).toBe('inProgress');
    expect(
      listingTaskStatus({ attributes: { publicData: { status: 'in-progress' } } })
    ).toBe('inProgress');
  });

  it('reads closed and cancelled', () => {
    expect(
      listingTaskStatus({ attributes: { publicData: { status: 'closed' } } })
    ).toBe('closed');
    expect(
      listingTaskStatus({ attributes: { publicData: { cancelled: true } } })
    ).toBe('cancelled');
  });
});
