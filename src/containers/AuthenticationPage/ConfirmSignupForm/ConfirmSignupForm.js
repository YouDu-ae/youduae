import React, { useEffect } from 'react';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import * as validators from '../../../util/validators';
import { getPropsForCustomUserFieldInputs } from '../../../util/userHelpers';

import { Form, PrimaryButton, FieldTextInput, CustomExtendedDataField } from '../../../components';

import FieldSelectUserType from '../FieldSelectUserType';
import UserFieldDisplayName from '../UserFieldDisplayName';
import UserFieldPhoneNumber from '../UserFieldPhoneNumber';

import css from './ConfirmSignupForm.module.css';

const getSoleUserTypeMaybe = userTypes =>
  Array.isArray(userTypes) && userTypes.length === 1 ? userTypes[0].userType : null;

const ConfirmSignupFormComponent = props => {
  // Для Google OAuth автоматически выбираем Provider
  const autoUserType = props.preselectedUserType || getSoleUserTypeMaybe(props.userTypes) || 'provider';
  
  return (
    <FinalForm
      {...props}
      mutators={{ ...arrayMutators }}
      initialValues={{ 
        userType: autoUserType,
        // Предзаполняем данные из Google OAuth, если они есть
        email: props.authInfo?.email || '',
        firstName: props.authInfo?.firstName || '',
        lastName: props.authInfo?.lastName || '',
      }}
      render={formRenderProps => {
      const {
        rootClassName,
        className,
        formId,
        handleSubmit,
        form, // ← Добавляем form API для программного управления
        inProgress,
        invalid,
        intl,
        termsAndConditions,
        authInfo,
        idp,
        preselectedUserType,
        userTypes,
        userFields,
        values,
      } = formRenderProps;

      const { userType } = values || {};

      // email
      const emailRequired = validators.required(
        intl.formatMessage({
          id: 'ConfirmSignupForm.emailRequired',
        })
      );
      const emailValid = validators.emailFormatValid(
        intl.formatMessage({
          id: 'ConfirmSignupForm.emailInvalid',
        })
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
      const submitDisabled = invalid || submitInProgress;

      // If authInfo is not available we should not show the ConfirmForm
      if (!authInfo) {
        return (
          <div className={css.loadingContainer}>
            <p className={css.loadingText}>
              <FormattedMessage id="ConfirmSignupForm.loadingAuthInfo" />
            </p>
          </div>
        );
      }

      // Initial values from idp provider
      const { email, firstName, lastName } = authInfo;

      // ⚠️ ВАЖНО: Для Google OAuth автоматически выбираем Provider
      // (Customer не могут регистрироваться через Google)
      const autoSelectedUserType = preselectedUserType || userType || 'provider';

      // Auto-submit form if all required data is available from Google OAuth
      useEffect(() => {
        // Check if we have all necessary data from Google
        const hasAllRequiredData = email && firstName && lastName;
        // Check if phone number field is required (it's not in our config)
        const phoneNumberRequired = userFieldProps.some(
          field => field.key === 'phoneNumber' && field.required
        );
        
        // If we have all data and phone is not required, auto-submit
        if (hasAllRequiredData && !phoneNumberRequired && !submitInProgress && form) {
          console.log('✅ Auto-submitting confirm form with Google data for Provider');
          // Delay to allow form to initialize
          setTimeout(() => {
            // Устанавливаем значения через Final Form API
            form.change('userType', autoSelectedUserType);
            form.change('email', email);
            form.change('firstName', firstName);
            form.change('lastName', lastName);
            
            // Программно отправляем форму
            setTimeout(() => {
              form.submit();
            }, 300); // Даём время на обновление формы
          }, 500);
        }
      }, [email, firstName, lastName, autoSelectedUserType, form, submitInProgress, userFieldProps]);

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          {/* Скрываем выбор типа пользователя для Google OAuth (автоматически Provider) */}
          {!preselectedUserType && (
            <FieldSelectUserType
              name="userType"
              userTypes={userTypes}
              hasExistingUserType={false}
              intl={intl}
            />
          )}
          
          {/* Скрытое поле для автоматического выбора Provider при Google OAuth */}
          {preselectedUserType && (
            <input type="hidden" name="userType" value={autoSelectedUserType} />
          )}

          {showDefaultUserFields ? (
            <div className={css.defaultUserFields}>
              <FieldTextInput
                type="email"
                id={formId ? `${formId}.email` : 'email'}
                name="email"
                autoComplete="email"
                label={intl.formatMessage({
                  id: 'ConfirmSignupForm.emailLabel',
                })}
                placeholder={intl.formatMessage({
                  id: 'ConfirmSignupForm.emailPlaceholder',
                })}
                initialValue={email}
                validate={validators.composeValidators(emailRequired, emailValid)}
              />
              <div className={css.name}>
                <FieldTextInput
                  className={css.firstNameRoot}
                  type="text"
                  id={formId ? `${formId}.firstName` : 'firstName'}
                  name="firstName"
                  autoComplete="given-name"
                  label={intl.formatMessage({
                    id: 'ConfirmSignupForm.firstNameLabel',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'ConfirmSignupForm.firstNamePlaceholder',
                  })}
                  initialValue={firstName}
                  validate={validators.required(
                    intl.formatMessage({
                      id: 'ConfirmSignupForm.firstNameRequired',
                    })
                  )}
                />
                <FieldTextInput
                  className={css.lastNameRoot}
                  type="text"
                  id={formId ? `${formId}.lastName` : 'lastName'}
                  name="lastName"
                  autoComplete="family-name"
                  label={intl.formatMessage({
                    id: 'ConfirmSignupForm.lastNameLabel',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'ConfirmSignupForm.lastNamePlaceholder',
                  })}
                  initialValue={lastName}
                  validate={validators.required(
                    intl.formatMessage({
                      id: 'ConfirmSignupForm.lastNameRequired',
                    })
                  )}
                />
              </div>

              <UserFieldDisplayName
                formName="ConfirmSignupForm"
                className={css.row}
                userTypeConfig={userTypeConfig}
                intl={intl}
              />
              <UserFieldPhoneNumber
                formName="ConfirmSignupForm"
                className={css.row}
                userTypeConfig={userTypeConfig}
                intl={intl}
              />
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
              <FormattedMessage id="ConfirmSignupForm.signUp" values={{ idp: idp }} />
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
  );
};

/**
 * A component that renders the confirm signup form, which is used with SSO authentication.
 *
 * @component
 * @param {Object} props
 * @param {string} props.rootClassName - The root class name that overrides the default class css.root
 * @param {string} props.className - The class that extends the root class
 * @param {string} props.formId - The form id
 * @param {boolean} props.inProgress - Whether the form is in progress
 * @param {ReactNode} props.termsAndConditions - The terms and conditions
 * @param {string} props.preselectedUserType - The preselected user type
 * @param {propTypes.userTypes} props.userTypes - The user types
 * @param {propTypes.listingFields} props.userFields - The user fields
 * @returns {JSX.Element}
 */
const ConfirmSignupForm = props => {
  const intl = useIntl();
  return <ConfirmSignupFormComponent {...props} intl={intl} />;
};

export default ConfirmSignupForm;
