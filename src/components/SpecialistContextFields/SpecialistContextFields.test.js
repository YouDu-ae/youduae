import React from 'react';
import '@testing-library/jest-dom';
import { Form as FinalForm } from 'react-final-form';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import SpecialistContextFields, { CONTEXT_FIELD_NAMES } from './SpecialistContextFields';

const { screen, fireEvent } = testingLibrary;

const fieldConfigs = {
  [CONTEXT_FIELD_NAMES.serviceAreas]: {
    enumOptions: [
      { option: 'all_dubai', label: 'Весь Дубай' },
      { option: 'jlt', label: 'JLT' },
      { option: 'jvc', label: 'JVC' },
    ],
  },
  [CONTEXT_FIELD_NAMES.languages]: {
    enumOptions: [
      { option: 'ru', label: 'Русский' },
      { option: 'en', label: 'English' },
    ],
  },
  [CONTEXT_FIELD_NAMES.availability]: {
    enumOptions: [{ option: 'weekends', label: 'Weekends' }],
  },
};

const renderFields = initialValues => {
  let formApi;
  render(
    <FinalForm
      onSubmit={() => {}}
      initialValues={initialValues}
      render={({ form }) => {
        formApi = form;
        return <SpecialistContextFields formId="test" fieldConfigs={fieldConfigs} />;
      }}
    />
  );
  return () => formApi.getState().values;
};

describe('SpecialistContextFields', () => {
  it('toggles chips on and off', () => {
    const values = renderFields({});

    fireEvent.click(screen.getByRole('checkbox', { name: 'Русский' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    expect(values()[CONTEXT_FIELD_NAMES.languages]).toEqual(['ru', 'en']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Русский' }));
    expect(values()[CONTEXT_FIELD_NAMES.languages]).toEqual(['en']);
  });

  // "All of Dubai" and single areas contradict each other.
  it('keeps all of Dubai and single areas mutually exclusive', () => {
    const values = renderFields({ [CONTEXT_FIELD_NAMES.serviceAreas]: ['jlt', 'jvc'] });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Весь Дубай' }));
    expect(values()[CONTEXT_FIELD_NAMES.serviceAreas]).toEqual(['all_dubai']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'JLT' }));
    expect(values()[CONTEXT_FIELD_NAMES.serviceAreas]).toEqual(['jlt']);
  });

  it('marks saved choices as selected', () => {
    renderFields({ [CONTEXT_FIELD_NAMES.availability]: ['weekends'] });
    expect(screen.getByRole('checkbox', { name: 'Weekends' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('stores the price as a whole number within range', () => {
    const values = renderFields({});
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '250' } });
    expect(values()[CONTEXT_FIELD_NAMES.priceFrom]).toBe(250);

    fireEvent.change(input, { target: { value: '' } });
    expect(values()[CONTEXT_FIELD_NAMES.priceFrom]).toBeNull();
  });
});
