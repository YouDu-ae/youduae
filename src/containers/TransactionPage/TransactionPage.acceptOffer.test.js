import { canAcceptOfferInChat, canDeclineOfferInChat } from './TransactionPage';

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
