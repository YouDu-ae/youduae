import React, { useState, useEffect } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../util/reactIntl';
import { ACCOUNT_SETTINGS_PAGES } from '../../../../routing/routeConfiguration';
import { getCurrentUserTypeRoles } from '../../../../util/userHelpers';
import {
  Avatar,
  InlineTextButton,
  LanguageSwitcher,
  LinkedLogo,
  Menu,
  MenuLabel,
  MenuContent,
  MenuItem,
  NamedLink,
  NotificationBadge,
} from '../../../../components';

import TopbarSearchForm from '../TopbarSearchForm/TopbarSearchForm';
import CustomLinksMenu from './CustomLinksMenu/CustomLinksMenu';

import css from './TopbarDesktop.module.css';

// Компонент: "Найти задания"
const SearchLink = () => {
  return (
    <NamedLink name="SearchPage" className={css.topbarLink}>
      <span className={css.topbarLinkLabel}>
        <FormattedMessage id="TopbarDesktop.searchLink" />
      </span>
    </NamedLink>
  );
};

// Компонент: "Вход и регистрация" - Желтая кнопка из Figma
const LoginLink = () => {
  return (
    <NamedLink name="LoginPage" className={css.loginButton}>
      <FormattedMessage id="TopbarDesktop.login" />
    </NamedLink>
  );
};

// Компонент: "Для специалистов" - серая ссылка из Figма
const ForSpecialistsLink = () => {
  return (
    <NamedLink name="CooperationPage" className={css.forSpecialistsLink}>
      <FormattedMessage id="TopbarDesktop.forSpecialists" />
    </NamedLink>
  );
};

const InboxLink = ({ notificationCount, inboxTab }) => {
  const notificationBadge = notificationCount > 0 ? (
    <NotificationBadge className={css.notificationBadge} count={notificationCount} />
  ) : null;
  return (
    <NamedLink className={css.topbarLink} name="InboxPage" params={{ tab: inboxTab }}>
      <span className={css.topbarLinkLabel}>
        <FormattedMessage id="TopbarDesktop.inbox" />
        {notificationBadge}
      </span>
    </NamedLink>
  );
};

const ProfileMenu = ({ currentPage, currentUser, onLogout, showManageListingsLink, inboxTab }) => {
  const currentPageClass = page => {
    const isAccountSettingsPage =
      page === 'AccountSettingsPage' && ACCOUNT_SETTINGS_PAGES.includes(currentPage);
    const isInboxPage = currentPage?.indexOf('InboxPage') === 0 && page?.indexOf('InboxPage') === 0;
    return currentPage === page || isAccountSettingsPage || isInboxPage ? css.currentPage : null;
  };

  return (
    <Menu>
      <MenuLabel className={css.profileMenuLabel} isOpenClassName={css.profileMenuIsOpen}>
        <Avatar className={css.avatar} user={currentUser} disableProfileLink />
      </MenuLabel>
      <MenuContent className={css.profileMenuContent}>
        <MenuItem key="InboxPage">
          <NamedLink
            className={classNames(css.menuLink, currentPageClass(`InboxPage:${inboxTab}`))}
            name="InboxPage"
            params={{ tab: inboxTab }}
          >
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.inbox" />
          </NamedLink>
        </MenuItem>
        {showManageListingsLink ? (
          <MenuItem key="ManageListingsPage">
            <NamedLink
              className={classNames(css.menuLink, currentPageClass('ManageListingsPage'))}
              name="ManageListingsPage"
            >
              <span className={css.menuItemBorder} />
              <FormattedMessage id="TopbarDesktop.yourListingsLink" />
            </NamedLink>
          </MenuItem>
        ) : null}
        <MenuItem key="ProfileSettingsPage">
          <NamedLink
            className={classNames(css.menuLink, currentPageClass('ProfileSettingsPage'))}
            name="ProfileSettingsPage"
          >
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.profileSettingsLink" />
          </NamedLink>
        </MenuItem>
        <MenuItem key="AccountSettingsPage">
          <NamedLink
            className={classNames(css.menuLink, currentPageClass('AccountSettingsPage'))}
            name="AccountSettingsPage"
          >
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.accountSettingsLink" />
          </NamedLink>
        </MenuItem>
        <MenuItem key="logout">
          <InlineTextButton rootClassName={css.logoutButton} onClick={onLogout}>
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.logout" />
          </InlineTextButton>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};

/**
 * Topbar for desktop layout
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {CurrentUser} props.currentUser API entity
 * @param {string?} props.currentPage
 * @param {boolean} props.isAuthenticated
 * @param {number} props.notificationCount
 * @param {Function} props.onLogout
 * @param {Function} props.onSearchSubmit
 * @param {Object?} props.initialSearchFormValues
 * @param {Object} props.intl
 * @param {Object} props.config
 * @param {boolean} props.showSearchForm
 * @param {boolean} props.showCreateListingsLink
 * @param {string} props.inboxTab
 * @returns {JSX.Element} search icon
 */
const TopbarDesktop = props => {
  const {
    className,
    config,
    customLinks,
    currentUser,
    currentPage,
    rootClassName,
    notificationCount = 0,
    intl,
    isAuthenticated,
    onLogout,
    onSearchSubmit,
    initialSearchFormValues = {},
    showSearchForm,
    showCreateListingsLink,
    inboxTab,
  } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const marketplaceName = config.marketplaceName;
  const authenticatedOnClientSide = mounted && isAuthenticated;
  const isAuthenticatedOrJustHydrated = isAuthenticated || !mounted;

  const giveSpaceForSearch = customLinks == null || customLinks?.length === 0;
  const classes = classNames(rootClassName || css.root, className);

  const inboxLinkMaybe =
    authenticatedOnClientSide ? (
      <InboxLink notificationCount={notificationCount} inboxTab={inboxTab} />
    ) : null;

  const profileMenuMaybe =
    authenticatedOnClientSide ? (
      <ProfileMenu
        currentPage={currentPage}
        currentUser={currentUser}
        onLogout={onLogout}
        showManageListingsLink={showCreateListingsLink}
        inboxTab={inboxTab}
      />
    ) : null;

  // Проверяем роли пользователя
  // NOTE: Using ROLES instead of userType string for proper role detection
  const userType = currentUser?.attributes?.profile?.publicData?.userType;
  const userRoles = getCurrentUserTypeRoles(config, currentUser);
  
  // ⚠️ NEW ROLE MAPPING:
  // - provider (Исполнитель): {customer: false, provider: true} → МОЖЕТ искать задания
  // - customer (Заказчик): {customer: true, provider: false} → НЕ может искать задания
  const isOnlyCustomer = !userRoles.customer && userRoles.provider; // Исполнитель
  
  // Debug logging
  console.log('🔍 TopbarDesktop - User check:', {
    hasCurrentUser: !!currentUser,
    userId: currentUser?.id?.uuid,
    userType,
    userRoles,
    isOnlyCustomer,
    authenticatedOnClientSide,
    isAuthenticatedOrJustHydrated,
    mounted,
  });
  
  const canCreateListings = showCreateListingsLink === true;
  const isSpecialist = !canCreateListings && isOnlyCustomer;

  // Для исполнителей (не создают задания) показываем "Найти задания"
  const searchLinkForCustomer =
    authenticatedOnClientSide && isSpecialist ? <SearchLink /> : null;
  
  // Для неавторизованных: показываем "Найти задания"
  const searchLinkForGuest = !isAuthenticatedOrJustHydrated ? <SearchLink /> : null;
  
  // Итоговая ссылка поиска (для Customer или гостей)
  const searchLinkMaybe = searchLinkForCustomer || searchLinkForGuest;
  
  console.log('🔍 TopbarDesktop - Search link visibility:', {
    searchLinkForCustomer: !!searchLinkForCustomer,
    searchLinkForGuest: !!searchLinkForGuest,
    searchLinkMaybe: !!searchLinkMaybe,
  });
  
  const loginLinkMaybe = isAuthenticatedOrJustHydrated ? null : <LoginLink />;

  const manageListingsLinkMaybe =
    authenticatedOnClientSide && canCreateListings ? (
      <NamedLink className={css.topbarLink} name="ManageListingsPage">
        <span className={css.topbarLinkLabel}>
          <FormattedMessage id="TopbarDesktop.yourListingsLink" />
        </span>
      </NamedLink>
    ) : null;
  
  // Убрана форма поиска из топбара
  // const searchFormMaybe = isAuthenticated && showSearchForm ? (
  //   <TopbarSearchForm
  //     className={classNames(css.searchLink, { [css.takeAvailableSpace]: giveSpaceForSearch })}
  //     desktopInputRoot={css.topbarSearchWithLeftPadding}
  //     onSubmit={onSearchSubmit}
  //     initialValues={initialSearchFormValues}
  //     appConfig={config}
  //   />
  // ) : null;

  // Фильтруем customLinks - убираем все ссылки на авторизацию (они будут справа)
  const filteredCustomLinks = customLinks.filter(link => {
    const text = link.text?.toLowerCase() || '';
    return !text.includes('login') && 
           !text.includes('sign') && 
           !text.includes('auth') && 
           !text.includes('автор') &&
           !text.includes('войти') && 
           !text.includes('регистр');
  });

  return (
    <nav className={classes}>
      {/* Левая часть (logopart): ТОЛЬКО логотип - из Figma */}
      <div className={css.leftSection}>
        <LinkedLogo
          className={css.logoLink}
          layout="desktop"
          alt={intl.formatMessage({ id: 'TopbarDesktop.logo' }, { marketplaceName })}
          linkToExternalSite={config?.topbar?.logoLink}
        />
      </div>

      {/* Правая часть (buttonpart): Для специалистов + Создать задачу + Войти - из Figma */}
      <div className={css.rightSection}>
        {authenticatedOnClientSide && isAuthenticated ? (
          canCreateListings ? (
            <>
              <CustomLinksMenu
                currentPage={currentPage}
                customLinks={filteredCustomLinks}
                intl={intl}
                hasClientSideContentReady={
                  authenticatedOnClientSide || !isAuthenticatedOrJustHydrated
                }
                showCreateListingsLink={showCreateListingsLink}
              />
              {manageListingsLinkMaybe}
              {inboxLinkMaybe}
              {profileMenuMaybe}
            </>
          ) : (
            <>
              {searchLinkMaybe}
              <ForSpecialistsLink />
              <CustomLinksMenu
                currentPage={currentPage}
                customLinks={filteredCustomLinks}
                intl={intl}
                hasClientSideContentReady={
                  authenticatedOnClientSide || !isAuthenticatedOrJustHydrated
                }
                showCreateListingsLink={false}
              />
              {inboxLinkMaybe}
              {profileMenuMaybe}
            </>
          )
        ) : (
          <>
            {searchLinkMaybe}
            <ForSpecialistsLink />
            <CustomLinksMenu
              currentPage={currentPage}
              customLinks={filteredCustomLinks}
              intl={intl}
              hasClientSideContentReady={
                authenticatedOnClientSide || !isAuthenticatedOrJustHydrated
              }
              showCreateListingsLink={false}
            />
            {loginLinkMaybe}
          </>
        )}
      </div>
    </nav>
  );
};

export default TopbarDesktop;
