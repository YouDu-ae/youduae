import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  NamedLink,
  Menu,
  MenuLabel,
  MenuContent,
  MenuItem,
  Avatar,
  LanguageSwitcher,
} from '../../components';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { useConfiguration } from '../../context/configurationContext';
import { pathByRouteName } from '../../util/routes';
import { FormattedMessage } from '../../util/reactIntl';
import { getCurrentUserTypeRoles } from '../../util/userHelpers';
import css from './TopbarCustom.module.css';

const TopbarCustom = props => {
  const { isAuthenticated, currentUser, onLogout } = props;
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const config = useConfiguration();

  const userRoles = getCurrentUserTypeRoles(config, currentUser);
  // ВНИМАНИЕ: роли инвертированы в конфигурации!
  // User Type "customer" в Console → userRoles.provider = true (Исполнитель)
  // User Type "provider" в Console → userRoles.customer = true (Заказчик)
  const isProvider = userRoles.customer && !userRoles.provider; // Заказчик (создает задания) - userType "provider" в Console
  const isCustomer = userRoles.provider; // Исполнитель (откликается) - userType "customer" в Console

  // --- burger ---
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const panelRef = useRef(null);

  const toggleBurger = () => setIsBurgerOpen(s => !s);
  const closeBurger = () => setIsBurgerOpen(false);

  // Закрыть при переходе по маршруту
  useEffect(() => {
    return history.listen(() => setIsBurgerOpen(false));
  }, [history]);

  // ESC и клик вне панели
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && closeBurger();
    const onClick = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (e.target.closest(`.${css.burgerBtn}`)) return;
        closeBurger();
      }
    };
    if (isBurgerOpen) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('mousedown', onClick);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [isBurgerOpen]);

  // Лочим прокрутку страницы при открытом меню
  useEffect(() => {
    const original = document.body.style.overflow;
    if (isBurgerOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isBurgerOpen]);

  const handleLoginClick = e => {
    e.preventDefault();
    const loginPath = pathByRouteName('LoginPage', routeConfiguration);
    history.push(loginPath);
  };

  const handleLogout = () => {
    onLogout().then(() => {
      const landingPath = pathByRouteName('LandingPage', routeConfiguration);
      history.push(landingPath);
    });
  };

  const renderAuthSection = () => {
    if (isAuthenticated && currentUser) {
      const currentUserName = currentUser.attributes.profile.displayName || 'User';
      return (
        <Menu>
          <MenuLabel className={css.profileMenuLabel} isOpenClassName={css.profileMenuIsOpen}>
            <Avatar className={css.avatar} user={currentUser} disableProfileLink />
            <span className={css.profileName}>{currentUserName}</span>
          </MenuLabel>
          <MenuContent className={css.profileMenuContent}>
            <MenuItem key="inbox">
              <NamedLink
                name="InboxPage"
                params={{ tab: isProvider ? 'sales' : 'orders' }}
                className={css.menuLink}
              >
                <FormattedMessage id="TopbarDesktop.inbox" defaultMessage="Сообщения" />
              </NamedLink>
            </MenuItem>
            {isProvider && (
              <MenuItem key="manage-listings">
                <NamedLink name="ManageListingsPage" className={css.menuLink}>
                  <FormattedMessage
                    id="TopbarDesktop.yourListingsLink"
                    defaultMessage="Мои задания"
                  />
                </NamedLink>
              </MenuItem>
            )}
            <MenuItem key="profile">
              <NamedLink
                name="ProfilePage"
                params={{ id: currentUser.id.uuid }}
                className={css.menuLink}
              >
                <FormattedMessage
                  id="TopbarDesktop.profileSettingsLink"
                  defaultMessage="Настройки профиля"
                />
              </NamedLink>
            </MenuItem>
            <MenuItem key="account">
              <NamedLink name="ContactDetailsPage" className={css.menuLink}>
                <FormattedMessage
                  id="TopbarDesktop.accountSettingsLink"
                  defaultMessage="Настройки аккаунта"
                />
              </NamedLink>
            </MenuItem>
            <MenuItem key="logout">
              <button className={css.logoutButton} onClick={handleLogout}>
                <FormattedMessage id="TopbarDesktop.logout" defaultMessage="Выйти" />
              </button>
            </MenuItem>
          </MenuContent>
        </Menu>
      );
    }
    return (
      <button type="button" className={css.enterBtn} onClick={handleLoginClick}>
        <FormattedMessage id="TopbarDesktop.login" defaultMessage="Войти" />
      </button>
    );
  };

  // Контент панелей в бургере
  const GuestMenu = () => (
    <ul className={css.burgerList}>
      <li>
        <NamedLink name="NewListingPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.createListing" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="SearchPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.forSpecialists" />
        </NamedLink>
      </li>
      <li className={css.burgerDivider} />
      <li>
        <NamedLink name="SearchPage" className={css.burgerSubLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.searchLink" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="PrivacyPolicyPage" className={css.burgerSubLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarCustom.aboutCompany" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="PrivacyPolicyPage" className={css.burgerSubLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarCustom.blog" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="PrivacyPolicyPage" className={css.burgerSubLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarCustom.contacts" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="PrivacyPolicyPage" className={css.burgerSubLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarCustom.contactUs" />
        </NamedLink>
      </li>
      <li className={css.burgerDivider} />
      <li>
        <button type="button" className={css.burgerPrimaryBtn} onClick={handleLoginClick}>
          <FormattedMessage id="TopbarDesktop.login" />
        </button>
      </li>
      <li className={css.langInBurger}>
        <LanguageSwitcher />
      </li>
    </ul>
  );

  // Customer (Исполнитель): Найти задания | Мои отзывы | Сообщения
  const CustomerMenu = () => (
    <ul className={css.burgerList}>
      <li>
        <NamedLink name="SearchPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.findTasks" />
        </NamedLink>
      </li>
      <li>
        <NamedLink
          name="ProfilePage"
          params={{ id: currentUser?.id?.uuid }}
          className={css.burgerLink}
          onClick={closeBurger}
        >
          <FormattedMessage id="TopbarDesktop.myReviews" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="InboxPage" params={{ tab: 'orders' }} className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.inbox" />
        </NamedLink>
      </li>
      <li>
        <NamedLink
          name="ProfilePage"
          params={{ id: currentUser?.id?.uuid }}
          className={css.burgerLink}
          onClick={closeBurger}
        >
          <FormattedMessage id="TopbarDesktop.profileSettingsLink" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="ContactDetailsPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.accountSettingsLink" />
        </NamedLink>
      </li>
      <li className={css.burgerDivider} />
      <li>
        <button type="button" className={css.burgerSecondaryBtn} onClick={handleLogout}>
          <FormattedMessage id="TopbarDesktop.logout" />
        </button>
      </li>
      <li className={css.langInBurger}>
        <LanguageSwitcher />
      </li>
    </ul>
  );

  // Provider (Заказчик): Создать задания | Мои задания | Сообщения
  const ProviderMenu = () => (
    <ul className={css.burgerList}>
      <li>
        <NamedLink name="NewListingPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.createListing" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="ManageListingsPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.yourListingsLink" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="InboxPage" params={{ tab: 'sales' }} className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.inbox" />
        </NamedLink>
      </li>
      <li>
        <NamedLink
          name="ProfilePage"
          params={{ id: currentUser?.id?.uuid }}
          className={css.burgerLink}
          onClick={closeBurger}
        >
          <FormattedMessage id="TopbarDesktop.profileSettingsLink" />
        </NamedLink>
      </li>
      <li>
        <NamedLink name="ContactDetailsPage" className={css.burgerLink} onClick={closeBurger}>
          <FormattedMessage id="TopbarDesktop.accountSettingsLink" />
        </NamedLink>
      </li>
      <li className={css.burgerDivider} />
      <li>
        <button type="button" className={css.burgerSecondaryBtn} onClick={handleLogout}>
          <FormattedMessage id="TopbarDesktop.logout" />
        </button>
      </li>
      <li className={css.langInBurger}>
        <LanguageSwitcher />
      </li>
    </ul>
  );

  return (
    <header className={css.wrapper}>
      <div className={css.container}>
        {/* ЛОГО */}
        <div className={css.leftSection}>
          <NamedLink name="LandingPage" className={css.logoLink} aria-label="На главную" onClick={closeBurger}>
            <div className={css.logoBox}>
              <div className={css.logoBadge} />
              <span className={css.logoText}>YouDu</span>
            </div>
          </NamedLink>
        </div>

        {/* Десктоп-навигация (прячем на <=1023px) */}
        {isAuthenticated ? (
          <nav className={`${css.rightSection} ${css.hideOnMobile}`} aria-label="Главная навигация">
            {isProvider ? (
              // Provider (Заказчик): Создать задания | Мои задания | Сообщения
              <>
                <NamedLink name="NewListingPage" className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.createListing" />
                </NamedLink>
                <NamedLink name="ManageListingsPage" className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.yourListingsLink" />
                </NamedLink>
                <NamedLink name="InboxPage" params={{ tab: 'sales' }} className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.inbox" />
                </NamedLink>
              </>
            ) : (
              // Customer (Исполнитель): Найти задания | Мои отзывы | Сообщения
              <>
                <NamedLink name="SearchPage" className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.findTasks" />
                </NamedLink>
                <NamedLink name="ProfilePage" params={{ id: currentUser?.id?.uuid }} className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.myReviews" />
                </NamedLink>
                <NamedLink name="InboxPage" params={{ tab: 'orders' }} className={css.navLinkUnified}>
                  <FormattedMessage id="TopbarDesktop.inbox" />
                </NamedLink>
              </>
            )}
            {renderAuthSection()}
            <div className={css.languageSwitcherWrapper}>
              <LanguageSwitcher />
            </div>
          </nav>
        ) : (
          <nav className={`${css.nav} ${css.hideOnMobile}`} aria-label="Главная навигация">
            <NamedLink name="SearchPage" className={css.navLink}>
              <FormattedMessage id="TopbarDesktop.forSpecialists" />
            </NamedLink>
            <div className={css.rightButtons}>
              <NamedLink name="NewListingPage" className={css.navLink}>
                <FormattedMessage id="TopbarDesktop.createListing" />
              </NamedLink>
              {renderAuthSection()}
              <div className={css.languageSwitcherWrapper}>
                <LanguageSwitcher />
              </div>
            </div>
          </nav>
        )}

        {/* Мобильная правая секция-подложка с бургером (<=1023px) */}
        <div className={`${css.rightSectionMobile} ${css.showOnlyOnMobile}`}>
          <button
            type="button"
            className={css.burgerBtn}
            aria-label={isBurgerOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isBurgerOpen}
            onClick={toggleBurger}
          >
            <span className={css.burgerLine} />
            <span className={css.burgerLine} />
          </button>
        </div>
      </div>

      {/* Оверлей */}
      <div className={`${css.burgerOverlay} ${isBurgerOpen ? css.open : ''}`} />

      {/* Панель */}
      <aside
        ref={panelRef}
        className={`${css.burgerPanel} ${isBurgerOpen ? css.open : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div className={css.burgerHeader}>
          {isAuthenticated ? (
            <div className={css.burgerUser}>
              <Avatar className={css.burgerUserAvatar} user={currentUser} disableProfileLink />
              <span className={css.burgerUserName}>
                {(currentUser && currentUser.attributes?.profile?.displayName) || 'User'}
              </span>
            </div>
          ) : (
            <div className={css.burgerLogo} />
          )}
          <button className={css.burgerClose} aria-label="Закрыть" onClick={closeBurger}>
            <span />
            <span />
          </button>
        </div>

        {isAuthenticated ? (isProvider ? <ProviderMenu /> : <CustomerMenu />) : <GuestMenu />}
      </aside>
    </header>
  );
};

export default TopbarCustom;
