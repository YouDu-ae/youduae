import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { TermsOfServicePageComponent } from './TermsOfServicePage';

const { waitFor } = testingLibrary;

describe('TermsOfServicePage', () => {
  // YouDu always shows its own terms: the Console asset holds Sharetribe's placeholder
  it('renders our own terms even if the Console asset fails to load', async () => {
    const errorMessage = 'TermsOfServicePage failed';
    let e = new Error(errorMessage);
    e.type = 'error';
    e.name = 'Test';

    const { getByRole } = render(
      <TermsOfServicePageComponent pageAssetsData={null} inProgress={false} error={e} />
    );

    await waitFor(() => {
      expect(
        getByRole('heading', { level: 1, name: 'YouDu.ae Terms of Service' })
      ).toBeInTheDocument();
      expect(getByRole('heading', { name: '1. Roles and Scope' })).toBeInTheDocument();
    });
  });
});
