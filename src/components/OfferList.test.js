import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../util/testHelpers';
import {
  getUserReviewsStats,
  queryOffers,
  transitionPrivileged,
  updateListingStatus,
} from '../util/api';

import OfferList from './OfferList';

jest.mock('../util/api', () => ({
  ...jest.requireActual('../util/api'),
  getUserReviewsStats: jest.fn(),
  queryOffers: jest.fn(),
  transitionPrivileged: jest.fn(),
  updateListingStatus: jest.fn(),
}));

jest.mock('../analytics/plausibleEvents', () => ({
  trackProviderSelected: jest.fn(),
}));

const { screen, waitFor, fireEvent } = testingLibrary;

// /api/query-offers answers with raw JSON:API: the specialist is only in
// relationships and included, never in tx.customer.
const offer = {
  id: { uuid: 'tx-1' },
  type: 'transaction',
  attributes: {
    lastTransition: 'transition/inquire',
    protectedData: { offer: { price: 150, currency: 'AED' } },
  },
  relationships: { customer: { data: { id: { uuid: 'user-2' }, type: 'user' } } },
};

const specialist = {
  id: { uuid: 'user-2' },
  type: 'user',
  attributes: { profile: { displayName: 'Иван П', abbreviatedName: 'ИП' } },
};

describe('OfferList', () => {
  beforeEach(() => {
    queryOffers.mockReset().mockResolvedValue({ data: { data: [offer], included: [specialist] } });
    getUserReviewsStats
      .mockReset()
      .mockResolvedValue({ data: { reviewCount: 0, averageRating: 0 } });
    transitionPrivileged.mockReset().mockResolvedValue({});
    updateListingStatus.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the chosen specialist and the deal on the task', async () => {
    render(<OfferList listingId="listing-1" isOwner />);

    fireEvent.click(await screen.findByRole('button', { name: 'OfferList.acceptButton' }));

    await waitFor(() =>
      expect(updateListingStatus).toHaveBeenCalledWith({
        listingId: 'listing-1',
        assignedTo: 'user-2',
        status: 'in-progress',
        transactionId: 'tx-1',
        executorName: 'Иван П',
      })
    );
  });
});
