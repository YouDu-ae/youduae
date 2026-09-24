import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { SERVICE_CATEGORIES } from '../../config/serviceCategories';
import ServiceCategorySelector from './ServiceCategorySelector';

const { screen, fireEvent } = testingLibrary;

const renderSelector = initialValues => {
  let formApi;
  render(
    <FinalForm
      onSubmit={() => {}}
      initialValues={initialValues}
      render={({ form }) => {
        formApi = form;
        return <ServiceCategorySelector />;
      }}
    />
  );
  return () => formApi.getState().values;
};

const labelOf = id => SERVICE_CATEGORIES.find(c => c.id === id).label.en;

describe('ServiceCategorySelector', () => {
  it('keeps saved categories and subcategories after mount', () => {
    const getValues = renderSelector({
      serviceCategories: ['repairs_main', 'Repair_digital'],
      subcategories: { repairs_main: ['handyman'] },
    });

    expect(getValues().serviceCategories).toEqual(['repairs_main', 'Repair_digital']);
    expect(getValues().subcategories).toEqual({ repairs_main: ['handyman'] });
  });

  it('adds and removes a category, dropping its subcategories on removal', () => {
    const getValues = renderSelector({
      serviceCategories: ['repairs_main'],
      subcategories: { repairs_main: ['handyman'] },
    });

    fireEvent.click(screen.getByText(labelOf('Repair_digital')));
    expect(getValues().serviceCategories).toEqual(['repairs_main', 'Repair_digital']);

    fireEvent.click(screen.getByText(labelOf('repairs_main')));
    expect(getValues().serviceCategories).toEqual(['Repair_digital']);
    expect(getValues().subcategories).toEqual({});
  });
});
