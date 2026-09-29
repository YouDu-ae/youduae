import React from 'react';
import '@testing-library/jest-dom';
import { Form as FinalForm } from 'react-final-form';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import AiRecommendationsConsentField from './AiRecommendationsConsentField';

const { screen, userEvent } = testingLibrary;

const renderInForm = (initialValues = {}) => {
  const onSubmit = jest.fn();
  let latest = {};
  render(
    <FinalForm
      onSubmit={onSubmit}
      initialValues={initialValues}
      render={({ values }) => {
        latest = values;
        return <AiRecommendationsConsentField formId="test" />;
      }}
    />
  );
  return () => latest;
};

describe('AiRecommendationsConsentField', () => {
  // Consent must be an explicit act, so the box starts unticked.
  it('starts unticked and records the tick', async () => {
    const values = renderInForm();
    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(values().aiRecommendationsConsent).toEqual(['granted']);
  });

  it('shows a stored consent as ticked, so it can be withdrawn', () => {
    renderInForm({ aiRecommendationsConsent: ['granted'] });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
