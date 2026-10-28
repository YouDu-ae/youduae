import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../util/testHelpers';
import { checkMyOffer, initiatePrivileged } from '../util/api';

import OfferForm from './OfferForm';

jest.mock('../util/api', () => ({
  ...jest.requireActual('../util/api'),
  checkMyOffer: jest.fn(),
  initiatePrivileged: jest.fn(),
}));

const { screen, waitFor, fireEvent } = testingLibrary;

// privateData tells the Telegram prompt the account is linked, so it asks nothing.
const specialist = {
  id: { uuid: 'user-1' },
  attributes: { profile: { privateData: { telegramChatId: 1 } } },
};

const renderForm = () =>
  render(
    <OfferForm
      listingId="listing-1"
      currentUser={specialist}
      currentUserId="user-1"
      isOnlyCustomer
    />
  );

const fillOffer = () => {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Сделаю завтра' } });
};

describe('OfferForm', () => {
  beforeEach(() => {
    checkMyOffer.mockReset().mockResolvedValue({ data: { hasOffer: false } });
    initiatePrivileged.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The Marketplace API answers this check with 403 for a guest.
  it('does not look for an earlier offer when a guest views the task', () => {
    render(<OfferForm listingId="listing-1" currentUser={null} isOnlyCustomer={false} />);

    expect(screen.getByText('OfferForm.loginToRespondTitle')).toBeInTheDocument();
    expect(checkMyOffer).not.toHaveBeenCalled();
  });

  it('looks for an earlier offer before a specialist can respond', async () => {
    renderForm();

    expect(checkMyOffer).toHaveBeenCalledWith('listing-1');
    await waitFor(() => expect(screen.getByText('OfferForm.title')).toBeInTheDocument());
  });

  // His deal stays accepted, which would otherwise read as being chosen.
  it('tells a specialist taken off the task that he cannot respond again', async () => {
    checkMyOffer.mockResolvedValue({
      data: { hasOffer: true, offerStatus: 'removed', transactionId: 'tx-1' },
    });
    renderForm();

    await waitFor(() => expect(screen.getByText('OfferForm.removedTitle')).toBeInTheDocument());
    expect(screen.queryByText('OfferForm.acceptedTitle')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'OfferForm.submitButton' })
    ).not.toBeInTheDocument();
  });

  it('sends one offer when the form is submitted twice', async () => {
    initiatePrivileged.mockReturnValue(new Promise(() => {}));
    renderForm();
    await waitFor(() => expect(screen.getByText('OfferForm.title')).toBeInTheDocument());

    fillOffer();
    const form = screen.getByRole('button', { name: 'OfferForm.submitButton' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(initiatePrivileged).toHaveBeenCalledTimes(1);
  });

  it('shows the sent offer instead of an error when the reply was lost', async () => {
    initiatePrivileged.mockRejectedValue(new TypeError('Load failed'));
    renderForm();
    await waitFor(() => expect(screen.getByText('OfferForm.title')).toBeInTheDocument());
    checkMyOffer.mockResolvedValue({
      data: { hasOffer: true, offerStatus: 'pending', transactionId: 'tx-1' },
    });

    fillOffer();
    fireEvent.click(screen.getByRole('button', { name: 'OfferForm.submitButton' }));

    await waitFor(() => expect(screen.getByText('OfferForm.pendingTitle')).toBeInTheDocument());
    expect(screen.queryByText('OfferForm.submitFailed')).not.toBeInTheDocument();
  });

  it('shows the error when no offer was made', async () => {
    initiatePrivileged.mockRejectedValue(new TypeError('Load failed'));
    renderForm();
    await waitFor(() => expect(screen.getByText('OfferForm.title')).toBeInTheDocument());

    fillOffer();
    fireEvent.click(screen.getByRole('button', { name: 'OfferForm.submitButton' }));

    await waitFor(() => expect(screen.getByText('OfferForm.submitFailed')).toBeInTheDocument());
    expect(checkMyOffer).toHaveBeenCalledTimes(2);
  });
});
