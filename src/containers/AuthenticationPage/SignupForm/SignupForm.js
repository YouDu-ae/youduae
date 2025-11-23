import React, { useState, useEffect } from 'react';
import { Form as FinalForm, Field } from 'react-final-form';
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
  ServiceCategorySelector,
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

      // email
      const emailRequired = validators.required(
        intl.formatMessage({
          id: 'SignupForm.emailRequired',
        })
      );
      const emailValid = validators.emailFormatValid(
        intl.formatMessage({
          id: 'SignupForm.emailInvalid',
        })
      );

      // password
      const passwordRequiredMessage = intl.formatMessage({
        id: 'SignupForm.passwordRequired',
      });
      const passwordMinLengthMessage = intl.formatMessage(
        {
          id: 'SignupForm.passwordTooShort',
        },
        {
          minLength: validators.PASSWORD_MIN_LENGTH,
        }
      );
      const passwordMaxLengthMessage = intl.formatMessage(
        {
          id: 'SignupForm.passwordTooLong',
        },
        {
          maxLength: validators.PASSWORD_MAX_LENGTH,
        }
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

      // Custom user fields. Since user types are not supported here,
      // only fields with no user type id limitation are selected.
      const userFieldProps = getPropsForCustomUserFieldInputs(userFields, intl, userType);

      const noUserTypes = !userType && !(userTypes?.length > 0);
      const userTypeConfig = userTypes.find(config => config.userType === userType);
      const showDefaultUserFields = userType || noUserTypes;
      const showCustomUserFields = (userType || noUserTypes) && userFieldProps?.length > 0;

  const classes = classNames(rootClassName || css.root, className);
  const submitInProgress = inProgress;
  const submitDisabled = invalid || submitInProgress || !otpState.verified;

  // Определяем состояние главной кнопки
  const getButtonState = () => {
    if (!otpState.sent && !otpState.verified) {
      return 'sendOtp'; // Шаг 1: Отправить код
    }
    if (otpState.sent && !otpState.verified) {
      return 'verifyOtp'; // Шаг 2: Проверить код
    }
    return 'submit'; // Шаг 3: Зарегистрироваться
  };

  const buttonState = getButtonState();

  // Обработчик универсальной кнопки
  const handleMainButtonClick = async (e) => {
    e.preventDefault();
    
    if (buttonState === 'sendOtp') {
      await handleSendOtp();
    } else if (buttonState === 'verifyOtp') {
      await handleVerifyOtp();
    } else if (buttonState === 'submit') {
      handleSubmit(e);
    }
  };

  // Проверяем, можно ли нажать кнопку
  const isMainButtonDisabled = () => {
    if (buttonState === 'sendOtp') {
      return !email || emailValid(email) || otpState.sending;
    }
    if (buttonState === 'verifyOtp') {
      const code = values?.emailOtpCode;
      return !code || code.length !== 6 || otpState.verifying;
    }
    return submitDisabled;
  };

  // Проверяем, показывать ли прогресс
  const isMainButtonInProgress = () => {
    if (buttonState === 'sendOtp') return otpState.sending;
    if (buttonState === 'verifyOtp') return otpState.verifying;
    return submitInProgress;
  };

  // Текст кнопки
  const getButtonText = () => {
    if (buttonState === 'sendOtp') {
      return intl.formatMessage({ id: 'SignupForm.sendVerificationCode' });
    }
    if (buttonState === 'verifyOtp') {
      return intl.formatMessage({ id: 'SignupForm.verifyCode' });
    }
    return intl.formatMessage({ id: 'SignupForm.signUp' });
  };

  const handleSendOtp = async () => {
    if (!email || emailValid(email)) {
      setOtpState(prev => ({
        ...prev,
        error: intl.formatMessage({ id: 'SignupForm.emailInvalid' }),
      }));
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
      setOtpState(prev => ({
        ...prev,
        error: intl.formatMessage({ id: 'SignupForm.emailOtpCodeInvalid' }),
      }));
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

  // Watch email changes and reset OTP state if email changes after verification
  useEffect(() => {
    if (otpState.sent || otpState.verified) {
      setOtpState(prev => ({
        ...prev,
        sent: false,
        verified: false,
        challengeToken: null,
        verifiedToken: null,
        error: null,
        info: null,
      }));
    }
  }, [email]);

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
          />

              <div className={css.name}>
                <FieldTextInput
                  className={css.firstNameRoot}
                  type="text"
                  id={formId ? `${formId}.fname` : 'fname'}
                  name="fname"
                  autoComplete="given-name"
                  label={intl.formatMessage({
                    id: 'SignupForm.firstNameLabel',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'SignupForm.firstNamePlaceholder',
                  })}
                  validate={validators.required(
                    intl.formatMessage({
                      id: 'SignupForm.firstNameRequired',
                    })
                  )}
                />
                <FieldTextInput
                  className={css.lastNameRoot}
                  type="text"
                  id={formId ? `${formId}.lname` : 'lname'}
                  name="lname"
                  autoComplete="family-name"
                  label={intl.formatMessage({
                    id: 'SignupForm.lastNameLabel',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'SignupForm.lastNamePlaceholder',
                  })}
                  validate={validators.required(
                    intl.formatMessage({
                      id: 'SignupForm.lastNameRequired',
                    })
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
                label={intl.formatMessage({
                  id: 'SignupForm.passwordLabel',
                })}
                placeholder={intl.formatMessage({
                  id: 'SignupForm.passwordPlaceholder',
                })}
                validate={passwordValidators}
              />

          <UserFieldPhoneNumber
            formName="SignupForm"
            className={css.row}
            userTypeConfig={userTypeConfig}
            intl={intl}
          />

          <Field name="verifiedToken">
            {({ input }) => {
              if (otpState.verifiedToken && input.value !== otpState.verifiedToken) {
                input.onChange(otpState.verifiedToken);
              }
              return <input type="hidden" {...input} />;
            }}
          </Field>
        </div>
      ) : null}

      {showCustomUserFields ? (
        <div className={css.customFields}>
          {/* Всегда показываем ServiceCategorySelector для Customer */}
          {userType === 'customer' && (
            <ServiceCategorySelector
              key="serviceCategories"
              name="serviceCategories"
              formId={formId}
              values={values}
            />
          )}
          
          {/* Остальные кастомные поля */}
          {userFieldProps.map(({ key, ...fieldProps}) => {
            // Пропускаем serviceCategories, так как мы его уже отрендерили выше
            if (key === 'serviceCategories') {
              return null;
            }
            // Для остальных полей используем стандартный компонент
            return <CustomExtendedDataField key={key} {...fieldProps} formId={formId} />;
          })}
        </div>
      ) : null}

      <div className={css.bottomWrapper}>
        {termsAndConditions}
        
        {/* Блок OTP - перемещён сюда, чтобы быть над кнопкой */}
        {otpState.sent && !otpState.verified && (
          <div className={css.otpCodeFieldContainer}>
            <FieldTextInput
              type="text"
              id={formId ? `${formId}.emailOtpCode` : 'emailOtpCode'}
              name="emailOtpCode"
              autoComplete="off"
              inputMode="numeric"
              maxLength={6}
              label={intl.formatMessage({ id: 'SignupForm.emailOtpCodeLabel' })}
              placeholder={intl.formatMessage({ id: 'SignupForm.emailOtpCodePlaceholder' })}
            />
            {/* Кнопка "Отправить повторно" */}
            <SecondaryButton
              type="button"
              className={css.resendOtpButton}
              disabled={otpState.sending}
              onClick={handleSendOtp}
            >
              <FormattedMessage id="SignupForm.emailOtpResendButton" />
            </SecondaryButton>
          </div>
        )}

        {/* Галочка после успешной верификации */}
        {otpState.verified && (
          <div className={classNames(css.emailOtpStatus, css.emailOtpStatusSuccess)}>
            <span className={css.verifiedIcon}>✓</span>
            <FormattedMessage id="SignupForm.emailOtpVerifiedStatus" />
          </div>
        )}

        {/* Сообщения об ошибках или информации */}
        {otpState.error && (
          <div className={classNames(css.emailOtpStatus, css.emailOtpStatusError)}>
            {otpState.error}
          </div>
        )}
        {otpState.info && (
          <div className={classNames(css.emailOtpStatus, css.emailOtpStatusInfo)}>
            {otpState.info}
          </div>
        )}
        
        {/* Универсальная кнопка с тремя состояниями */}
        <PrimaryButton 
          type="button"
          onClick={handleMainButtonClick}
          inProgress={isMainButtonInProgress()} 
          disabled={isMainButtonDisabled()}
        >
          {getButtonText()}
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

export default SignupForm;
