import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import { fakeIntl } from '../../../util/testData';
import { sendEmailOtp } from '../../../util/api';

import TermsAndConditions from '../TermsAndConditions/TermsAndConditions';
import SignupForm from './SignupForm';

jest.mock('../../../util/api', () => ({
  sendEmailOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
}));

const { screen, fireEvent, userEvent, waitFor } = testingLibrary;

const noop = () => null;

const userTypes = [
  {
    userType: 'a',
    label: 'Seller',
  },
  {
    userType: 'b',
    label: 'Buyer',
  },
  {
    userType: 'c',
    label: 'Guest',
  },
  {
    userType: 'd',
    label: 'Host',
  },
];

const userFields = [
  {
    key: 'enumField1',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'o1', label: 'l1' },
      { option: 'o2', label: 'l2' },
      { option: 'o3', label: 'l3' },
    ],
    saveConfig: {
      label: 'Enum Field 1',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
  {
    key: 'enumField2',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'o1', label: 'l1' },
      { option: 'o2', label: 'l2' },
      { option: 'o3', label: 'l3' },
    ],
    saveConfig: {
      label: 'Enum Field 2',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['c', 'd'],
    },
  },
  {
    key: 'textField',
    scope: 'private',
    schemaType: 'text',
    saveConfig: {
      label: 'Text Field',
      displayInSignUp: true,
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
  {
    key: 'booleanField',
    scope: 'protected',
    schemaType: 'boolean',
    saveConfig: {
      label: 'Boolean Field',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
];

describe('SignupForm', () => {
  // Terms and conditions component passed in as props
  const termsAndConditions = (
    <TermsAndConditions onOpenTermsOfService={noop} onOpenPrivacyPolicy={noop} intl={fakeIntl} />
  );

  // // If snapshot testing is preferred, this could be used
  // // However, this form starts to be too big DOM structure to be snapshot tested nicely
  // it('matches snapshot', () => {
  //   const tree = render(
  //     <SignupForm intl={fakeIntl} termsAndConditions={termsAndConditions} onSubmit={noop} />
  //   );
  //   expect(tree.asFragment()).toMatchSnapshot();
  // });

  // react-scripts runs jest with resetMocks, so the implementation has to be
  // (re)installed for every test rather than in the module factory.
  beforeEach(() => {
    sendEmailOtp.mockResolvedValue({ challengeToken: 'challenge-token' });
  });

  const selectSellerAndFillForm = async ({ skipTerms = false } = {}) => {
    await waitFor(() => {
      userEvent.selectOptions(
        screen.getByRole('combobox'),
        screen.getByRole('option', { name: 'Seller' })
      );
    });

    userEvent.type(
      screen.getByRole('textbox', { name: 'SignupForm.emailLabel' }),
      'joe@example.com'
    );
    userEvent.type(screen.getByRole('textbox', { name: 'SignupForm.firstNameLabel' }), 'Joe');
    userEvent.type(screen.getByRole('textbox', { name: 'SignupForm.lastNameLabel' }), 'Dunphy');
    userEvent.type(screen.getByLabelText('SignupForm.passwordLabel'), 'secret-password');
    userEvent.type(screen.getByLabelText('Text Field'), 'Text value');

    if (!skipTerms) {
      fireEvent.click(screen.getByLabelText(/AuthenticationPage.termsAndConditionsAcceptText/i));
    }
  };

  it('refuses to send a verification code until the rest of the form is filled', async () => {
    render(
      <SignupForm
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
      />
    );

    await waitFor(() => {
      userEvent.selectOptions(
        screen.getByRole('combobox'),
        screen.getByRole('option', { name: 'Seller' })
      );
    });

    // Only the email is filled in — the state that used to let people verify
    // their address and then get stuck on a dead submit button.
    userEvent.type(
      screen.getByRole('textbox', { name: 'SignupForm.emailLabel' }),
      'joe@example.com'
    );

    const button = screen.getByRole('button', { name: 'SignupForm.sendVerificationCode' });
    // The button stays clickable so the tap can explain what is missing.
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(sendEmailOtp).not.toHaveBeenCalled();
    expect(screen.getByText('SignupForm.completeFormBeforeOtp')).toBeInTheDocument();
  });

  it('sends a verification code once every required field is filled', async () => {
    render(
      <SignupForm
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
      />
    );

    await selectSellerAndFillForm();

    fireEvent.click(screen.getByRole('button', { name: 'SignupForm.sendVerificationCode' }));

    await waitFor(() => {
      expect(sendEmailOtp).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('SignupForm.completeFormBeforeOtp')).toBeNull();
  });

  it('clears the "complete the form" notice once the missing fields are filled', async () => {
    render(
      <SignupForm
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
      />
    );

    await selectSellerAndFillForm({ skipTerms: true });

    fireEvent.click(screen.getByRole('button', { name: 'SignupForm.sendVerificationCode' }));
    expect(screen.getByText('SignupForm.completeFormBeforeOtp')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/AuthenticationPage.termsAndConditionsAcceptText/i));

    await waitFor(() => {
      expect(screen.queryByText('SignupForm.completeFormBeforeOtp')).toBeNull();
    });
  });

  it('shows custom user fields according to configuration', async () => {
    render(
      <SignupForm
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
      />
    );

    // Simulate user interaction and select parent level category
    await waitFor(() => {
      userEvent.selectOptions(
        screen.getByRole('combobox'),
        screen.getByRole('option', { name: 'Seller' })
      );
    });

    // Show user fields that have not been limited to type and have displayInSignUp: true
    expect(screen.getByText('Enum Field 1')).toBeInTheDocument();
    expect(screen.getByText('Text Field')).toBeInTheDocument();

    // Don't show user fields that have displayInSignUp: false
    expect(screen.queryByText('Boolean Field')).toBeNull();

    // Don't show user fields that are limited to user types – SignupForm does not support user types yet!
    expect(screen.queryByText('Enum Field 2')).toBeNull();
  });
});
