import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import LandingPage from './LandingPage';

const { screen, userEvent } = testingLibrary;

describe('LandingPage', () => {
  // The page is fully self-contained: it must not depend on the hosted
  // landing-page asset, which is no longer fetched for this route.
  it('renders the hero without any hosted page asset', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('LandingPage.heroTitle');
    expect(screen.getByText('LandingPage.heroSubtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LandingPage.findButton' })).toBeInTheDocument();
  });

  it('keeps the typed task title in the search field', async () => {
    render(<LandingPage />);

    const input = screen.getByPlaceholderText('LandingPage.searchPlaceholder');
    await userEvent.type(input, 'Assemble a wardrobe');

    expect(input).toHaveValue('Assemble a wardrobe');
  });
});
