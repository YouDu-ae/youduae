const { completeRefusal, hireRefusal, removedSpecialists, taskOfDeal } = require('./hireRules');

describe('hireRefusal', () => {
  it('lets the author hire for an open task', () => {
    expect(hireRefusal({ publicData: {}, specialistId: 'user-2' })).toBeNull();
    expect(hireRefusal({ publicData: { status: 'open' }, specialistId: 'user-2' })).toBeNull();
  });

  // Pending offers now outlive the hire, so a second hire has to be stopped here.
  it('refuses a second executor while one works on the task', () => {
    const working = [
      { status: 'in-progress' },
      { hired: true },
      { assignedTo: 'user-1' },
      { status: 'completed', assignedTo: 'user-1' },
    ];

    working.forEach(publicData => {
      expect(hireRefusal({ publicData, specialistId: 'user-2' })).toBe('executor_already_chosen');
    });
  });

  it('lets the author hire again after changing the executor', () => {
    const publicData = {
      status: 'open',
      hired: false,
      assignedTo: null,
      excludedOfferCustomerIds: ['user-1'],
    };

    expect(hireRefusal({ publicData, specialistId: 'user-2' })).toBeNull();
  });

  it('never hires a specialist taken off the task again', () => {
    const publicData = { status: 'open', excludedOfferCustomerIds: ['user-1'] };

    expect(hireRefusal({ publicData, specialistId: 'user-1' })).toBe('specialist_removed');
  });

  it('refuses to hire for a cancelled task', () => {
    expect(hireRefusal({ publicData: { cancelled: true }, specialistId: 'user-2' })).toBe(
      'task_cancelled'
    );
  });
});

describe('completeRefusal', () => {
  it('lets the author complete the work of the current executor', () => {
    const publicData = {
      status: 'in-progress',
      assignedTo: 'user-2',
      excludedOfferCustomerIds: ['user-1'],
    };

    expect(completeRefusal({ publicData, specialistId: 'user-2' })).toBeNull();
  });

  // The removed executor's deal is still accepted, so Sharetribe would allow it.
  it('refuses to complete the deal of a specialist taken off the task', () => {
    const publicData = {
      status: 'in-progress',
      assignedTo: 'user-2',
      excludedOfferCustomerIds: ['user-1'],
    };

    expect(completeRefusal({ publicData, specialistId: 'user-1' })).toBe('removed_executor_deal');
  });
});

describe('removedSpecialists', () => {
  it('reads the specialists taken off the task', () => {
    expect(removedSpecialists({ excludedOfferCustomerIds: ['user-1'] })).toEqual(['user-1']);
  });

  it('treats a task without the list as having none', () => {
    expect(removedSpecialists({})).toEqual([]);
    expect(removedSpecialists(undefined)).toEqual([]);
    expect(removedSpecialists({ excludedOfferCustomerIds: 'user-1' })).toEqual([]);
  });
});

describe('taskOfDeal', () => {
  it('reads the task and the specialist of a deal', () => {
    const response = {
      data: {
        data: {
          relationships: {
            listing: { data: { id: { uuid: 'listing-1' } } },
            customer: { data: { id: { uuid: 'user-2' } } },
          },
        },
        included: [
          { type: 'user', id: { uuid: 'user-2' }, attributes: {} },
          {
            type: 'listing',
            id: { uuid: 'listing-1' },
            attributes: { publicData: { status: 'open' } },
          },
        ],
      },
    };

    expect(taskOfDeal(response)).toEqual({
      listingId: 'listing-1',
      specialistId: 'user-2',
      publicData: { status: 'open' },
    });
  });
});
