import { chatTaskStatus, listingTaskStatus } from './TaskSummaryMaybe';

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

  it('keeps a hired task in progress even though hiring closes the listing', () => {
    expect(
      listingTaskStatus({ attributes: { state: 'closed', publicData: { hired: true } } })
    ).toBe('inProgress');
  });
});

describe('chatTaskStatus', () => {
  // Hiring closes the listing, so these listings look finished on their own.
  const hiredListing = { attributes: { state: 'closed', publicData: { hired: true } } };
  const openListing = { attributes: { state: 'published', publicData: {} } };

  it('reads an accepted transaction as hired, not as finished', () => {
    expect(chatTaskStatus('accepted', hiredListing)).toBe('hired');
  });

  it('reads finished and reviewed transactions as completed', () => {
    expect(chatTaskStatus('completed', hiredListing)).toBe('completed');
    expect(chatTaskStatus('reviewed-by-customer', hiredListing)).toBe('completed');
    expect(chatTaskStatus('reviewed', hiredListing)).toBe('completed');
  });

  it('reads a declined offer', () => {
    expect(chatTaskStatus('declined', openListing)).toBe('declined');
  });

  it('falls back to the listing while the offer is still pending', () => {
    expect(chatTaskStatus('inquiry', openListing)).toBe('open');
    expect(chatTaskStatus('inquiry', hiredListing)).toBe('inProgress');
  });
});
