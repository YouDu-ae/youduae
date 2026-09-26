import React from 'react';
import '@testing-library/jest-dom';

import { createCurrentUser } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { WelcomePageComponent } from './WelcomePage';

jest.mock('../TopbarContainer/TopbarContainer', () => () => null);
jest.mock('../FooterContainer/FooterContainer', () => () => null);
jest.mock('../../hooks/useTelegramLink', () => ({
  useTelegramLink: () => ({ connecting: false, error: null, connect: () => {} }),
}));

const { screen, userEvent, waitFor } = testingLibrary;

const renderPage = (emailVerified, props = {}) =>
  render(
    <WelcomePageComponent
      scrollingDisabled={false}
      currentUser={createCurrentUser('alex', { emailVerified })}
      onResendVerificationEmail={() => Promise.resolve()}
      sendVerificationEmailInProgress={false}
      sendVerificationEmailError={null}
      {...props}
    />
  );

describe('WelcomePage e-mail verification', () => {
  it('asks an unverified user to verify, showing where the link went', () => {
    renderPage(false);
    expect(screen.getByText('WelcomePage.verifyEmailTitle')).toBeInTheDocument();
    expect(screen.getByText('WelcomePage.verifyEmailResend')).toBeInTheDocument();
  });

  it('says nothing about it once the address is verified', () => {
    renderPage(true);
    expect(screen.queryByText('WelcomePage.verifyEmailTitle')).not.toBeInTheDocument();
  });

  it('resends the verification e-mail and confirms it', async () => {
    const onResend = jest.fn(() => Promise.resolve());
    renderPage(false, { onResendVerificationEmail: onResend });

    await userEvent.click(screen.getByText('WelcomePage.verifyEmailResend'));

    expect(onResend).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText('WelcomePage.verifyEmailResent')).toBeInTheDocument()
    );
  });
});
