import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../util/testHelpers';
import { checkMyOffer } from '../util/api';

import OfferForm from './OfferForm';

jest.mock('../util/api', () => ({
  ...jest.requireActual('../util/api'),
  checkMyOffer: jest.fn(),
}));

const { screen, waitFor } = testingLibrary;

describe('OfferForm', () => {
  beforeEach(() => {
    checkMyOffer.mockReset().mockResolvedValue({ data: { hasOffer: false } });
  });

  // The Marketplace API answers this check with 403 for a guest.
  it('does not look for an earlier offer when a guest views the task', () => {
    render(<OfferForm listingId="listing-1" currentUser={null} isOnlyCustomer={false} />);

    expect(screen.getByText('OfferForm.loginToRespondTitle')).toBeInTheDocument();
    expect(checkMyOffer).not.toHaveBeenCalled();
  });

  it('looks for an earlier offer before a specialist can respond', async () => {
    render(
      <OfferForm
        listingId="listing-1"
        currentUser={{ id: { uuid: 'user-1' } }}
        currentUserId="user-1"
        isOnlyCustomer
      />
    );

    expect(checkMyOffer).toHaveBeenCalledWith('listing-1');
    await waitFor(() => expect(screen.getByText('OfferForm.title')).toBeInTheDocument());
  });
});
