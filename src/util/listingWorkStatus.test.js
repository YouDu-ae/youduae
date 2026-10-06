import { listingWorkStatus } from './listingWorkStatus';

describe('listingWorkStatus', () => {
  it('treats a task without status fields as open', () => {
    expect(listingWorkStatus({})).toBe('open');
    expect(listingWorkStatus(undefined)).toBe('open');
  });

  it('sees a chosen executor as work in progress', () => {
    expect(listingWorkStatus({ status: 'in-progress', hired: true })).toBe('in-progress');
    expect(listingWorkStatus({ hired: true })).toBe('in-progress');
    expect(listingWorkStatus({ assignedTo: 'user-1' })).toBe('in-progress');
  });

  // Completion writes only status: 'completed'; hired stays true.
  it('puts completion ahead of the executor flags', () => {
    expect(listingWorkStatus({ status: 'completed', hired: true, assignedTo: 'user-1' })).toBe(
      'completed'
    );
  });

  it('puts cancellation ahead of everything else', () => {
    expect(listingWorkStatus({ cancelled: true, hired: true })).toBe('cancelled');
    expect(listingWorkStatus({ status: 'cancelled' })).toBe('cancelled');
  });

  it('keeps a reopened task open even if executor fields linger', () => {
    expect(listingWorkStatus({ status: 'open', hired: true, assignedTo: 'user-1' })).toBe('open');
  });
});
