import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import AppDownloadPage, { APP_STORE_URL } from './AppDownloadPage';

jest.mock('../TopbarContainer/TopbarContainer', () => () => null);
jest.mock('../FooterContainer/FooterContainer', () => () => null);

const { screen, waitFor } = testingLibrary;

const COVER = /^https?:\/\/.+\/static\/blog\/youdu-ios-app\.jpg$/;

const metaContent = selector => document.querySelector(selector)?.getAttribute('content');

describe('AppDownloadPage', () => {
  it('gives link previews the app title, the promo text and the 1200×630 launch cover', async () => {
    render(<AppDownloadPage />);

    await waitFor(() => expect(metaContent('meta[property="og:image"]')).toMatch(COVER), {
      timeout: 3000,
    });
    expect(metaContent('meta[property="og:title"]')).toBe('AppDownloadPage.title');
    expect(metaContent('meta[property="og:description"]')).toBe('AppDownloadPage.description');
    expect(metaContent('meta[property="og:image:width"]')).toBe('1200');
    expect(metaContent('meta[property="og:image:height"]')).toBe('630');
    expect(metaContent('meta[name="twitter:image"]')).toMatch(COVER);
  });

  it('links the App Store badge straight to the app', () => {
    render(<AppDownloadPage />);

    expect(screen.getByRole('link', { name: 'FooterCustom.appStoreBadgeAlt' })).toHaveAttribute(
      'href',
      APP_STORE_URL
    );
  });
});
