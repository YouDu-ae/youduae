import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import * as validators from '../../../util/validators';
import { getPropsForCustomUserFieldInputs } from '../../../util/userHelpers';
import { sendEmailOtp, verifyEmailOtp } from '../../../util/api';

import {
  Form,
  PrimaryButton,
  SecondaryButton,
  FieldTextInput,
  CustomExtendedDataField,
} from '../../../components';

import FieldSelectUserType from '../FieldSelectUserType';
import UserFieldDisplayName from '../UserFieldDisplayName';
import UserFieldPhoneNumber from '../UserFieldPhoneNumber';

import css from './SignupForm.module.css';

const getSoleUserTypeMaybe = userTypes =>
  Array.isArray(userTypes) && userTypes.length === 1 ? userTypes[0].userType : null;

const SignupFormFields = props => {
  const {
    rootClassName,
    className,
    formId,
    handleSubmit,
    inProgress,
    invalid,
    intl,
    termsAndConditions,
    preselectedUserType,
    userTypes,
    userFields,
    values,
  } = props;

  const [otpState, setOtpState] = useState({
    sent: false,
    verified: false,
    sending: false,
    verifying: false,
    challengeToken: null,
    verifiedToken: null,
    error: null,
    info: null,
    lastSentAt: null,
  });

  const { userType, email } = values || {};

  // Email validation
  const emailRequired = validators.required(
    intl.formatMessage({ id: 'SignupForm.emailRequired' })
  );
  const emailValid = validators.emailFormatValid(
    intl.formatMessage({ id: 'SignupForm.emailInvalid' })
  );

  // Password validation
  const passwordRequiredMessage = intl.formatMessage({ id: 'SignupForm.passwordRequired' });
  const passwordMinLengthMessage = intl.formatMessage(
    { id: 'SignupForm.passwordTooShort' },
    { minLength: validators.PASSWORD_MIN_LENGTH }
  );
  const passwordMaxLengthMessage = intl.formatMessage(
    { id: 'SignupForm.passwordTooLong' },
    { maxLength: validators.PASSWORD_MAX_LENGTH }
  );
  const passwordMinLength = validators.minLength(
    passwordMinLengthMessage,
    validators.PASSWORD_MIN_LENGTH
  );
  const passwordMaxLength = validators.maxLength(
    passwordMaxLengthMessage,
    validators.PASSWORD_MAX_LENGTH
  );
  const passwordRequired = validators.requiredStringNoTrim(passwordRequiredMessage);
  const passwordValidators = validators.composeValidators(
    passwordRequired,
    passwordMinLength,
    passwordMaxLength
  );

  // Custom user fields
  const userFieldProps = getPropsForCustomUserFieldInputs(userFields, intl, userType);

  const noUserTypes = !userType && !(userTypes?.length > 0);
  const userTypeConfig = userTypes.find(config => config.userType === userType);
  const showDefaultUserFields = userType || noUserTypes;
  const showCustomUserFields = (userType || noUserTypes) && userFieldProps?.length > 0;

  const classes = classNames(rootClassName || css.root, className);
  const submitInProgress = inProgress;
  const submitDisabled = invalid || submitInProgress || !otpState.verified;

  const handleSendOtp = async () => {
    if (!email || !emailValid(email)) {
      setOtpState(prev => ({ ...prev, error: intl.formatMessage({ id: 'SignupForm.emailInvalid' }) }));
      return;
    }

    const now = Date.now();
    if (otpState.lastSentAt && now - otpState.lastSentAt < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - otpState.lastSentAt)) / 1000);
      setOtpState(prev => ({
        ...prev,
        info: intl.formatMessage({ id: 'SignupForm.emailOtpWaitMessage' }, { seconds: waitSeconds }),
      }));
      return;
    }

    setOtpState(prev => ({ ...prev, sending: true, error: null, info: null }));

    try {
      const response = await sendEmailOtp({ email, locale: intl.locale });
      setOtpState(prev => ({
        ...prev,
        sent: true,
        sending: false,
        challengeToken: response.challengeToken,
        lastSentAt: Date.now(),
        info: intl.formatMessage({ id: 'SignupForm.emailOtpSentMessage' }),
      }));
    } catch (error) {
      console.error('Failed to send email OTP:', error);
      setOtpState(prev => ({
        ...prev,
        sending: false,
        error: intl.formatMessage({ id: 'SignupForm.emailOtpSendFailed' }),
      }));
    }
  };

  const handleVerifyOtp = async () => {
    const code = values?.emailOtpCode;
    if (!code || code.length !== 6) {
      setOtpState(prev => ({ ...prev, error: intl.formatMessage({ id: 'SignupForm.emailOtpCodeInvalid' }) }));
      return;
    }

    setOtpState(prev => ({ ...prev, verifying: true, error: null, info: null }));

    try {
      const response = await verifyEmailOtp({ challengeToken: otpState.challengeToken, code });
      setOtpState(prev => ({
        ...prev,
        verified: true,
        verifying: false,
        verifiedToken: response.verifiedToken,
        info: null,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to verify email OTP:', error);
      setOtpState(prev => ({
        ...prev,
        verifying: false,
        error: intl.formatMessage({ id: 'SignupForm.emailOtpVerifyFailed' }),
      }));
    }
  };

  const handleEmailChange = () => {
    if (otpState.sent || otpState.verified) {
      setOtpState({
        sent: false,
        verified: false,
        sending: false,
        verifying: false,
        challengeToken: null,
        verifiedToken: null,
        error: null,
        info: null,
        lastSentAt: null,
      });
    }
  };

  return (
    <Form className={classes} onSubmit={handleSubmit}>
      {!preselectedUserType && (
        <FieldSelectUserType
          name="userType"
          userTypes={userTypes}
          hasExistingUserType={!!preselectedUserType}
          intl={intl}
        />
      )}

      {showDefaultUserFields ? (
        <div className={css.defaultUserFields}>
          <FieldTextInput
            type="email"
            id={formId ? `${formId}.email` : 'email'}
            name="email"
            autoComplete="email"
            label={intl.formatMessage({ id: 'SignupForm.emailLabel' })}
            placeholder={intl.formatMessage({ id: 'SignupForm.emailPlaceholder' })}
            validate={validators.composeValidators(emailRequired, emailValid)}
            onChange={handleEmailChange}
          />

          <div className={css.emailOtpContainer}>
            <SecondaryButton
              type="button"
              className={css.emailOtpSendButton}
              disabled={otpState.sending || otpState.verified || !email}
              inProgress={otpState.sending}
              onClick={handleSendOtp}
            >
              <FormattedMessage
                id={otpState.sent ? 'SignupForm.emailOtpResendButton' : 'SignupForm.emailOtpSendButton'}
              />
            </SecondaryButton>

            {otpState.sent && !otpState.verified ? (
              <div className={css.emailOtpInputRow}>
                <FieldTextInput
                  type="text"
                  id={formId ? `${formId}.emailOtpCode` : 'emailOtpCode'}
                  name="emailOtpCode"
                  autoComplete="off"
                  maxLength={6}
                  label={intl.formatMessage({ id: 'SignupForm.emailOtpCodeLabel' })}
                  placeholder={intl.formatMessage({ id: 'SignupForm.emailOtpCodePlaceholder' })}
                />
                <SecondaryButton
                  type="button"
                  className={css.emailOtpVerifyButton}
                  disabled={otpState.verifying}
                  inProgress={otpState.verifying}
                  onClick={handleVerifyOtp}
                >
                  <FormattedMessage id="SignupForm.emailOtpVerifyButton" />
                </SecondaryButton>
              </div>
            ) : otpState.verified ? (
              <div className={classNames(css.emailOtpStatus, css.emailOtpStatusSuccess)}>
                <FormattedMessage id="SignupForm.emailOtpVerifiedStatus" />
              </div>
            ) : null}

            {otpState.error ? (
              <div className={classNames(css.emailOtpStatus, css.emailOtpStatusError)}>
                {otpState.error}
              </div>
            ) : null}
            {otpState.info ? (
              <div className={classNames(css.emailOtpStatus, css.emailOtpStatusInfo)}>
                {otpState.info}
              </div>
            ) : null}
          </div>

          <div className={css.name}>
            <FieldTextInput
              className={css.firstNameRoot}
              type="text"
              id={formId ? `${formId}.fname` : 'fname'}
              name="fname"
              autoComplete="given-name"
              label={intl.formatMessage({ id: 'SignupForm.firstNameLabel' })}
              placeholder={intl.formatMessage({ id: 'SignupForm.firstNamePlaceholder' })}
              validate={validators.required(
                intl.formatMessage({ id: 'SignupForm.firstNameRequired' })
              )}
            />
            <FieldTextInput
              className={css.lastNameRoot}
              type="text"
              id={formId ? `${formId}.lname` : 'lname'}
              name="lname"
              autoComplete="family-name"
              label={intl.formatMessage({ id: 'SignupForm.lastNameLabel' })}
              placeholder={intl.formatMessage({ id: 'SignupForm.lastNamePlaceholder' })}
              validate={validators.required(
                intl.formatMessage({ id: 'SignupForm.lastNameRequired' })
              )}
            />
          </div>

          <UserFieldDisplayName
            formName="SignupForm"
            className={css.row}
            userTypeConfig={userTypeConfig}
            intl={intl}
          />

          <FieldTextInput
            className={css.password}
            type="password"
            id={formId ? `${formId}.password` : 'password'}
            name="password"
            autoComplete="new-password"
            label={intl.formatMessage({ id: 'SignupForm.passwordLabel' })}
            placeholder={intl.formatMessage({ id: 'SignupForm.passwordPlaceholder' })}
            validate={passwordValidators}
          />

          <UserFieldPhoneNumber
            formName="SignupForm"
            className={css.row}
            userTypeConfig={userTypeConfig}
            intl={intl}
          />

          <input type="hidden" name="verifiedToken" value={otpState.verifiedToken || ''} />
        </div>
      ) : null}

      {showCustomUserFields ? (
        <div className={css.customFields}>
          {userFieldProps.map(({ key, ...fieldProps }) => (
            <CustomExtendedDataField key={key} {...fieldProps} formId={formId} />
          ))}
        </div>
      ) : null}

      <div className={css.bottomWrapper}>
        {termsAndConditions}
        <PrimaryButton type="submit" inProgress={submitInProgress} disabled={submitDisabled}>
          <FormattedMessage id="SignupForm.signUp" />
        </PrimaryButton>
      </div>
    </Form>
  );
};

const SignupFormComponent = props => (
  <FinalForm
    {...props}
    mutators={{ ...arrayMutators }}
    initialValues={{ userType: props.preselectedUserType || getSoleUserTypeMaybe(props.userTypes) }}
    render={formRenderProps => <SignupFormFields {...formRenderProps} intl={props.intl} />}
  />
);

const SignupForm = props => {
  const intl = useIntl();
  return <SignupFormComponent {...props} intl={intl} />;
};

SignupForm.defaultProps = {
  rootClassName: null,
  className: null,
  formId: null,
  inProgress: false,
};

SignupForm.propTypes = {
  rootClassName: propTypes.string,
  className: propTypes.string,
  formId: propTypes.string,
  inProgress: propTypes.bool,
  termsAndConditions: propTypes.node.isRequired,
};

export default SignupForm;

