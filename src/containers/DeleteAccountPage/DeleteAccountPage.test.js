import React from 'react';
import '@testing-library/jest-dom';

import { createCurrentUser } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { DeleteAccountPageComponent } from './DeleteAccountPage';

const { screen, fireEvent, waitFor } = testingLibrary;

const response = (status, data = {}) => ({ status, json: async () => data });

const userWithProvider = () => {
  const user = createCurrentUser('user1');
  user.attributes.identityProviders = [{ idpId: 'google', userId: 'g-1' }];
  return user;
};

const renderPage = currentUser =>
  render(
    <DeleteAccountPageComponent
      currentUser={currentUser}
      scrollingDisabled={false}
      onLogout={() => Promise.resolve()}
    />
  );

const confirm = () => fireEvent.click(screen.getByRole('checkbox'));

const requestBody = () => JSON.parse(global.fetch.mock.calls[0][1].body);

describe('DeleteAccountPage', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('keeps the button disabled until deletion is confirmed', () => {
    renderPage(createCurrentUser('user1'));

    const button = screen.getByRole('button', { name: 'DeleteAccountPage.submitDelete' });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('DeleteAccountPage.passwordLabel'), {
      target: { value: 'secret' },
    });
    expect(button).toBeDisabled();

    confirm();
    expect(button).toBeEnabled();
  });

  it('deletes a password account at once', async () => {
    global.fetch = jest.fn(async () => response(200, { status: 'deleted' }));
    renderPage(createCurrentUser('user1'));

    fireEvent.change(screen.getByLabelText('DeleteAccountPage.passwordLabel'), {
      target: { value: 'secret' },
    });
    confirm();
    fireEvent.click(screen.getByRole('button', { name: 'DeleteAccountPage.submitDelete' }));

    expect(await screen.findByText('DeleteAccountPage.deletedTitle')).toBeInTheDocument();
    expect(requestBody()).toEqual({ currentPassword: 'secret', source: 'web' });
  });

  it('tells the person when the password is wrong', async () => {
    global.fetch = jest.fn(async () => response(403, { error: 'wrong_password' }));
    renderPage(createCurrentUser('user1'));

    fireEvent.change(screen.getByLabelText('DeleteAccountPage.passwordLabel'), {
      target: { value: 'wrong' },
    });
    confirm();
    fireEvent.click(screen.getByRole('button', { name: 'DeleteAccountPage.submitDelete' }));

    expect(await screen.findByText('DeleteAccountPage.errorWrongPassword')).toBeInTheDocument();
  });

  // Google and Apple sign-ins have no password to give, so Sharetribe cannot
  // delete them directly and the page sends a request instead.
  it('sends a request without a password for Google and Apple sign-ins', async () => {
    global.fetch = jest.fn(async () => response(202, { status: 'requested', withinDays: 30 }));
    renderPage(userWithProvider());

    expect(screen.queryByLabelText('DeleteAccountPage.passwordLabel')).not.toBeInTheDocument();
    confirm();
    fireEvent.click(screen.getByRole('button', { name: 'DeleteAccountPage.submitRequest' }));

    expect(await screen.findByText('DeleteAccountPage.requestedTitle')).toBeInTheDocument();
    await waitFor(() => expect(requestBody()).toEqual({ source: 'web' }));
  });
});
