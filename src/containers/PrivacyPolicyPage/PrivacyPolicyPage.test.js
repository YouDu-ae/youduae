import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { PrivacyPolicyPageComponent } from './PrivacyPolicyPage';

const { waitFor } = testingLibrary;

describe('PrivacyPolicyPage', () => {
  // YouDu always shows its own policy: the Console asset holds Sharetribe's placeholder
  it('renders our own policy even if the Console asset fails to load', async () => {
    const errorMessage = 'PrivacyPolicyPage failed';
    let e = new Error(errorMessage);
    e.type = 'error';
    e.name = 'Test';

    const { getByRole } = render(
      <PrivacyPolicyPageComponent pageAssetsData={null} inProgress={false} error={e} />
    );

    await waitFor(() => {
      expect(getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
      expect(getByRole('heading', { name: '1. Data We Process' })).toBeInTheDocument();
    });
  });
});
