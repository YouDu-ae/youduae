import React, { useState, useEffect, useRef } from 'react';
import { Form as FinalForm, Field } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';
import { Prompt } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import * as validators from '../../../util/validators';
import { getPropsForCustomUserFieldInputs } from '../../../util/userHelpers';
import {
  sendEmailOtp,
  verifyEmailOtp,
  getPhoneSignupConfig,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../../util/api';
import * as log from '../../../util/log';

import {
  Form,
  PrimaryButton,
  SecondaryButton,
  FieldTextInput,
  CustomExtendedDataField,
  ServiceCategorySelector,
} from '../../../components';

import FieldSelectUserType from '../FieldSelectUserType';
import AiRecommendationsConsentField from '../../../components/AiRecommendationsConsentField/AiRecommendationsConsentField';
import UserFieldDisplayName from '../UserFieldDisplayName';
import UserFieldPhoneNumber from '../UserFieldPhoneNumber';

import css from './SignupForm.module.css';

const getSoleUserTypeMaybe = userTypes =>
  Array.isArray(userTypes) && userTypes.length === 1 ? userTypes[0].userType : null;

const PHONE_SIGNUP_PREVIEW_PARAM = 'phoneSignupPreview';

// While the server keeps phone sign-up in preview, only a link with
// ?phoneSignupPreview=1 shows it. The flag outlives switching signup tabs.
const isPhoneSignupPreview = () => {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get(PHONE_SIGNUP_PREVIEW_PARAM) === '1') {
      window.sessionStorage.setItem(PHONE_SIGNUP_PREVIEW_PARAM, '1');
      return true;
    }
    return window.sessionStorage.getItem(PHONE_SIGNUP_PREVIEW_PARAM) === '1';
  } catch (e) {
    return false;
  }
};

const phoneDigits = value => String(value || '').replace(/[^\d+]/g, '');

// The server sends SMS codes to UAE mobiles only.
const isUaeMobileNumber = value => /^(?:\+971|00971|971)?0?5\d{8}$/.test(phoneDigits(value));

const PHONE_SEND_ERRORS = {
  tooManyCodeRequests: 'SignupForm.phoneOtpTooManyRequests',
  phoneTaken: 'SignupForm.phoneOtpPhoneTaken',
  invalidPhoneNumber: 'SignupForm.phoneOtpInvalidNumber',
  smsNotAvailable: 'SignupForm.phoneOtpSmsNotAvailable',
  channelUnavailable: 'SignupForm.phoneOtpChannelUnavailable',
};

const PHONE_VERIFY_ERRORS = {
  tooManyAttempts: 'SignupForm.phoneOtpTooManyAttempts',
  codeExpired: 'SignupForm.phoneOtpCodeExpired',
};

const SignupFormFields = props => {
  const {
    rootClassName,
    className,
    formId,
    form,
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
    channel: null,
  });
  const autoSubmitAfterOtpRef = useRef(false);
  const prevEmailRef = useRef(null);
  const prevPhoneRef = useRef(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [incompleteFormNotice, setIncompleteFormNotice] = useState(false);
  const [phoneMode, setPhoneMode] = useState(false);

  const { userType, email } = values || {};
  const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
  const normalizedPhone = phoneDigits(values?.phoneNumber);
  const smsAvailable = isUaeMobileNumber(values?.phoneNumber);
  const verifiedTokenField = phoneMode ? 'phoneVerifiedToken' : 'verifiedToken';
  const otpCodeField = phoneMode ? 'phoneOtpCode' : 'emailOtpCode';
  const verifiedTokenInForm = values?.[verifiedTokenField];
  const otpStartedRef = useRef(false);
  otpStartedRef.current = !!(otpState.sent || otpState.verified || otpState.sending);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getPhoneSignupConfig({ preview: isPhoneSignupPreview() }))
      .then(config => {
        // A late answer must not switch an email code that is already on its way.
        if (!cancelled && config?.enabled && !otpStartedRef.current) {
          setPhoneMode(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasStartedSignup = !!(
    (email && String(email).trim()) ||
    (values?.fname && String(values.fname).trim()) ||
    (values?.lname && String(values.lname).trim()) ||
    (values?.password && String(values.password).length > 0) ||
    values?.phoneNumber ||
    otpState.sent ||
    otpState.verified
  );
  // Block leave while drafting signup. Once a submit has been fired the guard is
  // dropped, otherwise it also intercepts the redirect that follows a successful
  // signup and the user is left staring at the form.
  const blockLeaveWithoutSignup = hasStartedSignup && !inProgress && !submitAttempted;

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

  // Phone sign-up has nothing to send the code to without the number.
  const phoneSignupUserTypeConfig = {
    ...userTypeConfig,
    phoneNumberSettings: { displayInSignUp: true, required: true },
    defaultUserFields: { ...userTypeConfig?.defaultUserFields, phoneNumber: true },
  };

  const classes = classNames(rootClassName || css.root, className);
  const submitInProgress = inProgress;
  const hasServiceCategories =
    userType !== 'customer' ||
    (Array.isArray(values?.serviceCategories) && values.serviceCategories.length > 0);

  const submitDisabled = invalid || submitInProgress || !otpState.verified || !hasServiceCategories;

  // The rest of the form has to be complete before we send a code. Verifying the
  // email first left people with a confirmed address and a dead submit button.
  const formReadyForOtp = !invalid && hasServiceCategories;

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

  // Marks every field as touched so Final Form renders its errors, then brings
  // the first offending field into view.
  const revealMissingFields = () => {
    const registered = form.getRegisteredFields();

    registered.forEach(name => {
      form.focus(name);
      form.blur(name);
    });

    const firstInvalid = registered.find(name => form.getFieldState(name)?.invalid);
    const node = firstInvalid ? document.querySelector(`[name="${firstInvalid}"]`) : null;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setIncompleteFormNotice(true);
  };

  // Обработчик универсальной кнопки
  const handleMainButtonClick = async e => {
    e.preventDefault();

    if (buttonState === 'sendOtp') {
      if (!formReadyForOtp) {
        revealMissingFields();
        return;
      }
      await (phoneMode ? handleSendPhoneOtp('whatsapp') : handleSendOtp());
    } else if (buttonState === 'verifyOtp') {
      await (phoneMode ? handleVerifyPhoneOtp() : handleVerifyOtp());
    } else if (buttonState === 'submit') {
      setSubmitAttempted(true);
      handleSubmit(e);
    }
  };

  const handleSendSmsClick = async e => {
    e.preventDefault();
    if (!formReadyForOtp) {
      revealMissingFields();
      return;
    }
    await handleSendPhoneOtp('sms');
  };

  // Проверяем, можно ли нажать кнопку
  const isMainButtonDisabled = () => {
    if (buttonState === 'sendOtp') {
      // Deliberately clickable while the form is incomplete: the tap points at
      // the missing fields instead of doing nothing.
      return !!otpState.sending;
    }
    if (buttonState === 'verifyOtp') {
      const code = values?.[otpCodeField];
      return !code || code.length !== 6 || otpState.verifying;
    }
    return submitDisabled;
  };

  // Проверяем, показывать ли прогресс
  const isMainButtonInProgress = () => {
    if (buttonState === 'sendOtp') {
      return phoneMode ? otpState.sending === 'whatsapp' : !!otpState.sending;
    }
    if (buttonState === 'verifyOtp') return otpState.verifying;
    return submitInProgress;
  };

  // Текст кнопки
  const getButtonText = () => {
    if (buttonState === 'sendOtp') {
      return intl.formatMessage({
        id: phoneMode ? 'SignupForm.sendCodeWhatsApp' : 'SignupForm.sendVerificationCode',
      });
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
      const response = await sendEmailOtp({ email: normalizedEmail || email, locale: intl.locale });
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
      log.error(error, 'signup-otp-send-failed', { email });
      const minutes = Math.max(1, Math.ceil((error?.retryAfterSeconds || 60) / 60));
      setOtpState(prev => ({
        ...prev,
        sending: false,
        error:
          error?.error === 'tooManyCodeRequests'
            ? intl.formatMessage({ id: 'SignupForm.emailOtpTooManyRequests' }, { minutes })
            : intl.formatMessage({ id: 'SignupForm.emailOtpSendFailed' }),
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
      // Put token into Final Form so signup can proceed without an extra click
      if (form?.change) {
        form.change('verifiedToken', response.verifiedToken);
      }
      autoSubmitAfterOtpRef.current = true;
      const categoriesReady =
        userType !== 'customer' ||
        (Array.isArray(values?.serviceCategories) && values.serviceCategories.length > 0);
      setOtpState(prev => ({
        ...prev,
        verified: true,
        verifying: false,
        verifiedToken: response.verifiedToken,
        info: categoriesReady
          ? intl.formatMessage({ id: 'SignupForm.emailOtpVerifiedAutoSubmit' })
          : intl.formatMessage({ id: 'SignupForm.emailOtpVerifiedFillAndSubmit' }),
        error: null,
      }));
    } catch (error) {
      console.error('Failed to verify email OTP:', error);
      log.error(error, 'signup-otp-verify-failed', { email });
      setOtpState(prev => ({
        ...prev,
        verifying: false,
        error: intl.formatMessage({
          id:
            error?.error === 'tooManyAttempts'
              ? 'SignupForm.emailOtpTooManyAttempts'
              : 'SignupForm.emailOtpVerifyFailed',
        }),
      }));
    }
  };

  const handleSendPhoneOtp = async channel => {
    const now = Date.now();
    if (otpState.channel === channel && otpState.lastSentAt && now - otpState.lastSentAt < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - otpState.lastSentAt)) / 1000);
      setOtpState(prev => ({
        ...prev,
        info: intl.formatMessage({ id: 'SignupForm.emailOtpWaitMessage' }, { seconds: waitSeconds }),
      }));
      return;
    }

    setOtpState(prev => ({ ...prev, sending: channel, error: null, info: null }));

    try {
      const response = await sendPhoneOtp({
        phoneNumber: values?.phoneNumber,
        channel,
        locale: intl.locale,
      });
      setOtpState(prev => ({
        ...prev,
        sent: true,
        sending: false,
        challengeToken: response.challengeToken,
        channel,
        lastSentAt: Date.now(),
        info: intl.formatMessage(
          {
            id: channel === 'sms' ? 'SignupForm.phoneOtpSentSms' : 'SignupForm.phoneOtpSentWhatsApp',
          },
          { phone: response.phoneNumber }
        ),
      }));
    } catch (error) {
      log.error(error, 'signup-phone-otp-send-failed', { channel, reason: error?.error });
      const minutes = Math.max(1, Math.ceil((error?.retryAfterSeconds || 60) / 60));
      setOtpState(prev => ({
        ...prev,
        sending: false,
        error: intl.formatMessage(
          { id: PHONE_SEND_ERRORS[error?.error] || 'SignupForm.phoneOtpSendFailed' },
          { minutes }
        ),
      }));
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const code = values?.phoneOtpCode;
    if (!code || code.length !== 6) {
      setOtpState(prev => ({
        ...prev,
        error: intl.formatMessage({ id: 'SignupForm.emailOtpCodeInvalid' }),
      }));
      return;
    }

    setOtpState(prev => ({ ...prev, verifying: true, error: null, info: null }));

    try {
      const response = await verifyPhoneOtp({ challengeToken: otpState.challengeToken, code });
      if (form?.change) {
        form.change('phoneVerifiedToken', response.verifiedToken);
      }
      autoSubmitAfterOtpRef.current = true;
      setOtpState(prev => ({
        ...prev,
        verified: true,
        verifying: false,
        verifiedToken: response.verifiedToken,
        info: intl.formatMessage({
          id: hasServiceCategories
            ? 'SignupForm.phoneOtpVerifiedAutoSubmit'
            : 'SignupForm.phoneOtpVerifiedFillAndSubmit',
        }),
        error: null,
      }));
    } catch (error) {
      log.error(error, 'signup-phone-otp-verify-failed', { reason: error?.error });
      setOtpState(prev => ({
        ...prev,
        verifying: false,
        error: intl.formatMessage({
          id: PHONE_VERIFY_ERRORS[error?.error] || 'SignupForm.emailOtpVerifyFailed',
        }),
      }));
    }
  };

  // A verified token only lives for 30 minutes. Without this the code input is
  // already unmounted by then and there is no way to start verification over.
  const handleRequestNewCode = () => {
    autoSubmitAfterOtpRef.current = false;
    if (form?.change) {
      form.change(verifiedTokenField, undefined);
      form.change(otpCodeField, undefined);
    }
    setOtpState(prev => ({
      ...prev,
      sent: false,
      verified: false,
      challengeToken: null,
      verifiedToken: null,
      error: null,
      info: null,
    }));
  };

  // Drop the "complete the form" hint as soon as it stops being true.
  useEffect(() => {
    if (formReadyForOtp && incompleteFormNotice) {
      setIncompleteFormNotice(false);
    }
  }, [formReadyForOtp, incompleteFormNotice]);

  // After OTP success → finish signup automatically (account is created only here)
  useEffect(() => {
    if (!autoSubmitAfterOtpRef.current || !otpState.verified || !otpState.verifiedToken) {
      return undefined;
    }
    // Wait until Final Form has verifiedToken + categories before auto-submit
    if (!verifiedTokenInForm || !hasServiceCategories) {
      return undefined;
    }
    const t = setTimeout(() => {
      if (!autoSubmitAfterOtpRef.current) {
        return;
      }
      if (invalid || inProgress) {
        // Stay armed on purpose: this effect re-runs once the form turns valid,
        // so completing the last field finishes signup without another tap.
        setOtpState(prev => ({
          ...prev,
          info: intl.formatMessage({
            id: phoneMode
              ? 'SignupForm.phoneOtpVerifiedFillAndSubmit'
              : 'SignupForm.emailOtpVerifiedFillAndSubmit',
          }),
        }));
        return;
      }
      autoSubmitAfterOtpRef.current = false;
      setSubmitAttempted(true);
      setOtpState(prev => ({
        ...prev,
        info: intl.formatMessage({
          id: phoneMode
            ? 'SignupForm.phoneOtpVerifiedAutoSubmit'
            : 'SignupForm.emailOtpVerifiedAutoSubmit',
        }),
      }));
      handleSubmit();
    }, 150);
    return () => clearTimeout(t);
  }, [
    otpState.verified,
    otpState.verifiedToken,
    verifiedTokenInForm,
    hasServiceCategories,
    invalid,
    inProgress,
    handleSubmit,
    intl,
    phoneMode,
  ]);

  // Warn on browser close / refresh
  useEffect(() => {
    if (!blockLeaveWithoutSignup) {
      return undefined;
    }
    const onBeforeUnload = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [blockLeaveWithoutSignup]);

  // Reset OTP only when email actually changes (not on every render)
  useEffect(() => {
    const prev = prevEmailRef.current;
    prevEmailRef.current = normalizedEmail || null;
    if (phoneMode || prev == null || prev === normalizedEmail) {
      return;
    }
    if (otpState.sent || otpState.verified) {
      autoSubmitAfterOtpRef.current = false;
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
  }, [normalizedEmail, phoneMode, otpState.sent, otpState.verified]);

  // In phone sign-up the code belongs to the number, so a new number starts over.
  useEffect(() => {
    const prev = prevPhoneRef.current;
    prevPhoneRef.current = normalizedPhone || null;
    if (!phoneMode || prev == null || prev === normalizedPhone) {
      return;
    }
    if (otpState.sent || otpState.verified) {
      autoSubmitAfterOtpRef.current = false;
      form.change('phoneVerifiedToken', undefined);
      setOtpState(prevState => ({
        ...prevState,
        sent: false,
        verified: false,
        challengeToken: null,
        verifiedToken: null,
        channel: null,
        lastSentAt: null,
        error: null,
        info: null,
      }));
    }
  }, [normalizedPhone, phoneMode, otpState.sent, otpState.verified, form]);

  return (
    <Form className={classes} onSubmit={handleSubmit}>
      <Prompt
        when={blockLeaveWithoutSignup}
        message={intl.formatMessage({ id: 'SignupForm.leaveWithoutSignupConfirm' })}
      />
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
            userTypeConfig={phoneMode ? phoneSignupUserTypeConfig : userTypeConfig}
            intl={intl}
          />

          <Field name={verifiedTokenField}>
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
          {userType === 'customer' && <AiRecommendationsConsentField formId={formId} />}
          
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
        
        {/* OTP pending: account is not created until code is confirmed */}
        {otpState.sent && !otpState.verified && (
          <div className={css.otpCodeFieldContainer}>
            <div className={classNames(css.emailOtpStatus, css.emailOtpStatusPending)}>
              <FormattedMessage
                id={
                  phoneMode
                    ? 'SignupForm.phoneOtpPendingAccountNotice'
                    : 'SignupForm.emailOtpPendingAccountNotice'
                }
              />
            </div>
            <FieldTextInput
              type="text"
              id={formId ? `${formId}.${otpCodeField}` : otpCodeField}
              name={otpCodeField}
              autoComplete={phoneMode ? 'one-time-code' : 'off'}
              inputMode="numeric"
              maxLength={6}
              label={intl.formatMessage({ id: 'SignupForm.emailOtpCodeLabel' })}
              placeholder={intl.formatMessage({ id: 'SignupForm.emailOtpCodePlaceholder' })}
            />
            <button
              type="button"
              className={css.resendOtpButton}
              disabled={!!otpState.sending}
              onClick={() => (phoneMode ? handleSendPhoneOtp(otpState.channel) : handleSendOtp())}
            >
              <FormattedMessage id="SignupForm.emailOtpResendButton" />
            </button>
            {phoneMode && (otpState.channel === 'sms' || smsAvailable) ? (
              <button
                type="button"
                className={css.resendOtpButton}
                disabled={!!otpState.sending}
                onClick={() =>
                  handleSendPhoneOtp(otpState.channel === 'sms' ? 'whatsapp' : 'sms')
                }
              >
                <FormattedMessage
                  id={
                    otpState.channel === 'sms'
                      ? 'SignupForm.phoneOtpSwitchToWhatsApp'
                      : 'SignupForm.phoneOtpSwitchToSms'
                  }
                />
              </button>
            ) : null}
          </div>
        )}

        {/* Галочка после успешной верификации */}
        {otpState.verified && (
          <div className={classNames(css.emailOtpStatus, css.emailOtpStatusSuccess)}>
            <FormattedMessage
              id={
                phoneMode ? 'SignupForm.phoneOtpVerifiedStatus' : 'SignupForm.emailOtpVerifiedStatus'
              }
            />
            <button type="button" className={css.resendOtpButton} onClick={handleRequestNewCode}>
              <FormattedMessage id="SignupForm.emailOtpRequestNewCode" />
            </button>
          </div>
        )}

        {incompleteFormNotice && (
          <div className={classNames(css.emailOtpStatus, css.emailOtpStatusError)}>
            <FormattedMessage
              id={
                phoneMode ? 'SignupForm.completeFormBeforePhoneOtp' : 'SignupForm.completeFormBeforeOtp'
              }
            />
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
        {phoneMode && buttonState === 'sendOtp' && smsAvailable ? (
          <SecondaryButton
            type="button"
            className={css.smsButton}
            onClick={handleSendSmsClick}
            inProgress={otpState.sending === 'sms'}
            disabled={!!otpState.sending}
          >
            <FormattedMessage id="SignupForm.sendCodeSms" />
          </SecondaryButton>
        ) : null}
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
