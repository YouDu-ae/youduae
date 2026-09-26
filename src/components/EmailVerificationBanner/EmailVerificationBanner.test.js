import React from 'react';
import '@testing-library/jest-dom';

import { createCurrentUser } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import EmailVerificationBanner from './EmailVerificationBanner';

const { screen, userEvent, waitFor } = testingLibrary;

const renderBanner = ({ emailVerified = false, pathname = '/inbox/sales', onResend } = {}) =>
  render(
    <EmailVerificationBanner
      currentUser={createCurrentUser('alex', { emailVerified })}
      pathname={pathname}
      onResend={onResend || (() => Promise.resolve())}
      inProgress={false}
      error={null}
    />
  );

describe('EmailVerificationBanner', () => {
  afterEach(() => window.localStorage.clear());

  it('asks an unverified user to verify', () => {
    renderBanner();
    expect(screen.getByText('EmailVerificationBanner.text')).toBeInTheDocument();
  });

  it('stays away once the address is verified', () => {
    renderBanner({ emailVerified: true });
    expect(screen.queryByText('EmailVerificationBanner.text')).not.toBeInTheDocument();
  });

  it('leaves pages with their own prompt alone', () => {
    renderBanner({ pathname: '/welcome' });
    expect(screen.queryByText('EmailVerificationBanner.text')).not.toBeInTheDocument();
  });

  it('hides for three days after "Later"', async () => {
    const { unmount } = renderBanner();
    await userEvent.click(screen.getByText('EmailVerificationBanner.later'));
    expect(screen.queryByText('EmailVerificationBanner.text')).not.toBeInTheDocument();

    unmount();
    renderBanner();
    expect(screen.queryByText('EmailVerificationBanner.text')).not.toBeInTheDocument();
  });

  it('resends the link and says where it went', async () => {
    const onResend = jest.fn(() => Promise.resolve());
    renderBanner({ onResend });

    await userEvent.click(screen.getByText('EmailVerificationBanner.resend'));

    expect(onResend).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText('EmailVerificationBanner.resent')).toBeInTheDocument()
    );
  });
});
