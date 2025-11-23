import React from 'react';
import AuthenticationPage from '../AuthenticationPage/AuthenticationPage';

/**
 * Страница регистрации специалиста (Customer) для /cooperation/signup/customer
 * Отображает только форму регистрации без вкладок
 */
const CooperationSignupPage = props => {
  return (
    <AuthenticationPage
      {...props}
      tab="signup"
      userType="customer"
      hideAuthTabs={true}
    />
  );
};

export default CooperationSignupPage;

