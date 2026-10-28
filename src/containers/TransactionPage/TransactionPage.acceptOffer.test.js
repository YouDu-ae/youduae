import {
  canAcceptOfferInChat,
  canDeclineOfferInChat,
  hiredListingUpdate,
  isRemovedSpecialistDeal,
} from './TransactionPage';

const openListing = { attributes: { state: 'published', publicData: {} } };
const hiredListing = { attributes: { state: 'published', publicData: { hired: true } } };

const params = overrides => ({
  isProviderRole: true,
  processName: 'assignment-flow-v3',
  lastTransition: 'transition/inquire',
  listing: openListing,
  ...overrides,
});

describe('canAcceptOfferInChat', () => {
  it('lets the task author hire while the offer is pending', () => {
    expect(canAcceptOfferInChat(params())).toBe(true);
  });

  it('hides the button from the specialist', () => {
    expect(canAcceptOfferInChat(params({ isProviderRole: false }))).toBe(false);
  });

  it('hides the button once the offer is no longer pending', () => {
    expect(canAcceptOfferInChat(params({ lastTransition: 'transition/accept-offer' }))).toBe(false);
    expect(canAcceptOfferInChat(params({ lastTransition: 'transition/decline-offer' }))).toBe(false);
  });

  it('hides the button when someone else is already hired for the task', () => {
    expect(canAcceptOfferInChat(params({ listing: hiredListing }))).toBe(false);
  });

  it('stays out of other transaction processes', () => {
    expect(canAcceptOfferInChat(params({ processName: 'default-booking' }))).toBe(false);
  });
});

describe('canDeclineOfferInChat', () => {
  it('lets the task author decline a pending offer', () => {
    expect(canDeclineOfferInChat(params())).toBe(true);
  });

  it('still allows declining after someone else has been hired', () => {
    expect(canDeclineOfferInChat(params({ listing: hiredListing }))).toBe(true);
  });

  it('hides the button from the specialist', () => {
    expect(canDeclineOfferInChat(params({ isProviderRole: false }))).toBe(false);
  });

  it('hides the button once the offer has been answered', () => {
    expect(canDeclineOfferInChat(params({ lastTransition: 'transition/decline-offer' }))).toBe(
      false
    );
    expect(canDeclineOfferInChat(params({ lastTransition: 'transition/accept-offer' }))).toBe(
      false
    );
  });
});

describe('isRemovedSpecialistDeal', () => {
  const reopenedListing = {
    attributes: { publicData: { status: 'open', excludedOfferCustomerIds: ['user-1'] } },
  };

  // Their deal stays accepted, so the chat would still offer to complete it.
  it('recognises the chat of a specialist taken off the task', () => {
    expect(
      isRemovedSpecialistDeal({ listing: reopenedListing, customer: { id: { uuid: 'user-1' } } })
    ).toBe(true);
  });

  it('leaves the current executor alone', () => {
    expect(
      isRemovedSpecialistDeal({ listing: reopenedListing, customer: { id: { uuid: 'user-2' } } })
    ).toBe(false);
    expect(
      isRemovedSpecialistDeal({ listing: openListing, customer: { id: { uuid: 'user-1' } } })
    ).toBe(false);
  });
});

describe('hiredListingUpdate', () => {
  it('records the specialist, the deal and the name on the task', () => {
    const update = hiredListingUpdate({
      listing: { id: { uuid: 'listing-1' } },
      transaction: { id: { uuid: 'tx-1' } },
      customer: { id: { uuid: 'user-2' }, attributes: { profile: { displayName: 'Иван П' } } },
    });

    expect(update).toEqual({
      listingId: 'listing-1',
      assignedTo: 'user-2',
      status: 'in-progress',
      transactionId: 'tx-1',
      executorName: 'Иван П',
    });
  });
});
