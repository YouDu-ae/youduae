import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import SectionSpecialistContext from './SectionSpecialistContext';

const { screen } = testingLibrary;

const userFieldConfig = [
  {
    key: 'serviceAreas',
    enumOptions: [
      { option: 'all_dubai', label: 'All of Dubai' },
      { option: 'jlt', label: 'JLT' },
    ],
  },
  {
    key: 'languages',
    enumOptions: [
      { option: 'ru', label: 'Russian' },
      { option: 'tr', label: 'Turkish' },
      { option: 'ar', label: 'Arabic' },
    ],
  },
  { key: 'availability', enumOptions: [{ option: 'evenings', label: 'Evenings' }] },
];

describe('SectionSpecialistContext', () => {
  it('shows only the chosen options', () => {
    render(
      <SectionSpecialistContext
        userFieldConfig={userFieldConfig}
        publicData={{ serviceAreas: ['all_dubai'], languages: ['ru', 'tr'], priceFrom: 150 }}
      />
    );

    expect(screen.getByText('All of Dubai')).toBeInTheDocument();
    expect(screen.getByText('Russian')).toBeInTheDocument();
    expect(screen.getByText('Turkish')).toBeInTheDocument();
    expect(screen.queryByText('JLT')).not.toBeInTheDocument();
    expect(screen.queryByText('Arabic')).not.toBeInTheDocument();
    expect(screen.queryByText('SpecialistContext.profileAvailability')).not.toBeInTheDocument();
    expect(screen.getByText('SpecialistContext.profilePrice')).toBeInTheDocument();
  });

  it('renders nothing for an empty profile', () => {
    const { container } = render(
      <SectionSpecialistContext userFieldConfig={userFieldConfig} publicData={{ languages: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
