import React, { useState } from 'react';
import classNames from 'classnames';
import { Form as FinalForm } from 'react-final-form';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Contexts
import { useRouteConfiguration } from '../../../../context/routeConfigurationContext';
import { useConfiguration } from '../../../../context/configurationContext';

// Utility
import { FormattedMessage } from '../../../../util/reactIntl';
import { createResourceLocatorString } from '../../../../util/routes';
import { isOriginInUse } from '../../../../util/search';
import { stringifyDateToISO8601 } from '../../../../util/dates';
import { getCurrentUserTypeRoles } from '../../../../util/userHelpers';

// Shared components
import { Form, PrimaryButton } from '../../../../components';

import FilterCategories from './FilterCategories/FilterCategories';
import FilterDateRange from './FilterDateRange/FilterDateRange';
import FilterLocation from './FilterLocation/FilterLocation';
import FilterKeyword from './FilterKeyword/FilterKeyword';
import FilterCategory from './FilterCategory/FilterCategory';

import css from './SearchCTA.module.css';

const GRID_CONFIG = [
  { gridCss: css.gridCol1 },
  { gridCss: css.gridCol2 },
  { gridCss: css.gridCol3 },
  { gridCss: css.gridCol4 },
];

const getGridCount = numberOfFields => {
  const gridConfig = GRID_CONFIG[numberOfFields - 1];
  return gridConfig ? gridConfig.gridCss : GRID_CONFIG[0].gridCss;
};

const isEmpty = value => {
  if (value == null) return true;
  return value.hasOwnProperty('length') && value.length === 0;
};

const formatDateValue = (dateRange, queryParamName) => {
  const hasDates = dateRange;
  const { startDate, endDate } = hasDates ? dateRange : {};
  const start = startDate ? stringifyDateToISO8601(startDate) : null;
  const end = endDate ? stringifyDateToISO8601(endDate) : null;
  const value = start && end ? `${start},${end}` : null;
  return { [queryParamName]: value };
};

export const SearchCTA = React.forwardRef((props, ref) => {
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const config = useConfiguration();
  
  // Get current user from Redux state
  const currentUser = useSelector(state => state.user.currentUser);

  const { categories, dateRange, keywordSearch, locationSearch } = props.searchFields;

  const [submitDisabled, setSubmitDisabled] = useState(false);

  const categoryConfig = config.categoryConfiguration;
  
  // Check if current user is a customer (executor)
  // Исполнители (provider) должны искать задания, а не создавать их
  // NOTE: Using ROLES instead of userType string for proper role detection
  const userType = currentUser?.attributes?.profile?.publicData?.userType;
  const userRoles = getCurrentUserTypeRoles(config, currentUser);
  
  // ⚠️ NEW ROLE MAPPING:
  // - provider (Исполнитель): {customer: false, provider: true} → МОЖЕТ искать задания
  // - customer (Заказчик): {customer: true, provider: false} → НЕ может искать задания
  const isOnlyCustomer = !userRoles.customer && userRoles.provider; // Исполнитель
  
  // Debug logging
  console.log('🔍 SearchCTA - User check:', {
    hasCurrentUser: !!currentUser,
    userId: currentUser?.id?.uuid,
    userType,
    userRoles,
    isOnlyCustomer,
  });

  const filters = {
    categories: {
      enabled: categories,
      isValid: () => categoryConfig.categories.length > 0,
      render: alignLeft => (
        <div className={css.filterField} key="categories">
          <FilterCategories categories={categoryConfig.categories} alignLeft={alignLeft} />
        </div>
      ),
    },
    keywordSearch: {
      enabled: keywordSearch,
      isValid: () => keywordSearch,
      render: alignLeft => (
        <div className={css.filterField} key="keywordSearch">
          <FilterKeyword />
        </div>
      ),
    },
    locationSearch: {
      enabled: locationSearch,
      isValid: () => locationSearch,
      render: alignLeft => (
        <div className={css.filterField} key="locationSearch">
          <FilterCategory alignLeft={alignLeft} />
        </div>
      ),
    },

    dateRange: {
      enabled: dateRange,
      isValid: () => dateRange,
      render: alignLeft => (
        <div className={css.filterField} key="dateRange">
          <FilterDateRange config={config} alignLeft={alignLeft} />
        </div>
      ),
    },
  };

  const addFilters = filterOrder => {
    const enabledFilters = filterOrder.filter(
      key => filters[key]?.enabled && filters[key]?.isValid()
    );

    const totalEnabled = enabledFilters.length;

    return enabledFilters.map((key, index) => {
      const filter = filters[key];
      const isLast = index === totalEnabled - 1;
      const alignLeft = totalEnabled === 1 || !isLast;

      return filter.enabled && filter.isValid() ? filter.render(alignLeft) : null;
    });
  };

  // Count the number search fields that are enabled
  const fieldCountForGrid = Object.values(filters).filter(field => field.enabled && field.isValid())
    .length;

  //  If no search fields are enabled, we return null (Console won't allow you to enable 0 search fields)
  if (!fieldCountForGrid) {
    return null;
  }

  const onSubmit = values => {
    // IMPORTANT: Different behavior based on user role
    // - Customer (исполнитель): Can ONLY search for tasks, NOT create them
    // - Provider (заказчик) or unauthenticated: Can create tasks
    
    console.log('🎯 SearchCTA onSubmit - Decision:', {
      userType,
      userRoles,
      isOnlyCustomer,
      willSearchForTasks: isOnlyCustomer,
      willCreateListing: !isOnlyCustomer,
    });
    
    if (isOnlyCustomer) {
      // Customer should search for existing tasks to respond to
      console.log('🔍 Customer user - redirecting to search page');
      
      // Convert form values to query parameters (original logic)
      let queryParams = {};

      Object.entries(values).forEach(([key, value]) => {
        if (!isEmpty(value)) {
          if (key == 'dateRange') {
            const { dates } = formatDateValue(value, 'dates');
            queryParams.dates = dates;
          } else if (key == 'location') {
            if (value.selectedPlace) {
              const {
                search,
                selectedPlace: { origin, bounds },
              } = value;
              queryParams.bounds = bounds;
              queryParams.address = search;

              if (isOriginInUse(config) && origin) {
                queryParams.origin = `${origin.lat},${origin.lng}`;
              }
            }
          } else {
            queryParams[key] = value;
          }
        }
      });

      const to = createResourceLocatorString('SearchPage', routeConfiguration, {}, queryParams);
      history.push(to);
    } else {
      // Provider or unauthenticated user - redirect to create new listing
      console.log('✨ Provider/Guest user - redirecting to create listing page');
      const to = createResourceLocatorString('NewListingPage', routeConfiguration, {}, {});
      history.push(to);
    }
  };

  return (
    <div className={classNames(css.searchBarContainer, getGridCount(fieldCountForGrid))}>
      <FinalForm
        onSubmit={onSubmit}
        {...props}
        render={({ fieldRenderProps, handleSubmit }) => {
          return (
            <Form
              role="search"
              onSubmit={handleSubmit}
              className={classNames(css.gridContainer, getGridCount(fieldCountForGrid))}
            >
              {addFilters(['categories', 'keywordSearch', 'locationSearch', 'dateRange'])}

              <PrimaryButton disabled={submitDisabled} className={css.submitButton} type="submit">
                <FormattedMessage id="PageBuilder.SearchCTA.buttonLabel" />
              </PrimaryButton>
            </Form>
          );
        }}
      />
    </div>
  );
});

SearchCTA.displayName = 'SearchCTA';
