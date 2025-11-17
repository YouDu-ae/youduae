import { EXTENDED_DATA_SCHEMA_TYPES } from './types';
import { getFieldValue } from './fieldHelpers';

/**
 * Get the namespaced attribute key based on the specified extended data scope and attribute key
 * @param {*} scope extended data scope
 * @param {*} key attribute key in extended data
 * @returns a string containing the namespace prefix and the attribute name
 */
export const addScopePrefix = (scope, key) => {
  const scopeFnMap = {
    private: k => `priv_${k}`,
    protected: k => `prot_${k}`,
    public: k => `pub_${k}`,
    meta: k => `meta_${k}`,
  };

  const validKey = key.replace(/\s/g, '_');
  const keyScoper = scopeFnMap[scope];

  return !!keyScoper ? keyScoper(validKey) : validKey;
};

/**
 * Pick extended data fields from given form data.
 * Picking is based on extended data configuration for the user and target scope and user type.
 *
 * This expects submit data to be namespaced (e.g. 'pub_') and it returns the field without that namespace.
 * This function is used when form submit values are restructured for the actual API endpoint.
 *
 * Note: This returns null for those fields that are managed by configuration, but don't match target user type.
 *       These might exists if user swaps between user types before saving the user.
 *
 * @param {Object} data values to look through against userConfig.js and util/configHelpers.js
 * @param {String} targetScope Check that the scope of extended data the config matches
 * @param {String} targetUserType Check that the extended data is relevant for this user type.
 * @param {Object} userFieldConfigs Extended data configurations for user fields.
 * @returns Array of picked extended data fields from submitted data.
 */
export const pickUserFieldsData = (data, targetScope, targetUserType, userFieldConfigs) => {
  return userFieldConfigs.reduce((fields, field) => {
    const { key, userTypeConfig, scope = 'public', schemaType } = field || {};
    const namespacedKey = addScopePrefix(scope, key);

    const isKnownSchemaType = EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType);
    const isTargetScope = scope === targetScope;
    const isTargetUserType =
      !userTypeConfig.limitToUserTypeIds || userTypeConfig.userTypeIds.includes(targetUserType);

    if (isKnownSchemaType && isTargetScope && isTargetUserType) {
      // ВАЖНО: Сначала проверяем значение БЕЗ namespace (свежее из формы),
      // и только потом с namespace (старое из initialValues)
      let fieldValue = getFieldValue(data, key);
      if (fieldValue == null && namespacedKey !== key) {
        fieldValue = getFieldValue(data, namespacedKey);
      }
      
      if (key === 'subcategories') {
        console.log(`🔍 [pickUserFieldsData] Checking key: "${key}"`);
        console.log(`🔍 [pickUserFieldsData] Value from key "${key}":`, getFieldValue(data, key));
        console.log(`🔍 [pickUserFieldsData] Value from namespacedKey "${namespacedKey}":`, getFieldValue(data, namespacedKey));
        console.log(`🔍 [pickUserFieldsData] Final fieldValue:`, fieldValue);
        console.log(`🔍 [pickUserFieldsData] Type:`, typeof fieldValue);
      }
      
      return { ...fields, [key]: fieldValue };
    } else if (isKnownSchemaType && isTargetScope && !isTargetUserType) {
      // Note: this clears extra custom fields
      // These might exists if user swaps between user types before saving the user.
      return { ...fields, [key]: null };
    }
    return fields;
  }, {});
};

/**
 * Pick extended data fields from given extended data of the user entity.
 * Picking is based on extended data configuration for the user and target scope and user type.
 *
 * This returns namespaced (e.g. 'pub_') initial values for the form.
 *
 * @param {Object} data extended data values to look through against userConfig.js and util/configHelpers.js
 * @param {String} targetScope Check that the scope of extended data the config matches
 * @param {String} targetUserType Check that the extended data is relevant for this user type.
 * @param {Object} userFieldConfigs Extended data configurations for user fields.
 * @returns Array of picked extended data fields
 */
export const initialValuesForUserFields = (data, targetScope, targetUserType, userFieldConfigs) => {
  return userFieldConfigs.reduce((fields, field) => {
    const { key, userTypeConfig, scope = 'public', schemaType } = field || {};
    const namespacedKey = addScopePrefix(scope, key);

    const isKnownSchemaType = EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType);
    const isTargetScope = scope === targetScope;
    const isTargetUserType =
      !userTypeConfig?.limitToUserTypeIds || userTypeConfig?.userTypeIds?.includes(targetUserType);

    if (isKnownSchemaType && isTargetScope && isTargetUserType) {
      let fieldValue = getFieldValue(data, key);
      
      // Десериализуем subcategories из JSON-строки обратно в объект
      if (key === 'subcategories' && typeof fieldValue === 'string') {
        try {
          fieldValue = JSON.parse(fieldValue);
        } catch (e) {
          console.warn('Failed to parse subcategories JSON:', e);
          fieldValue = {};
        }
      }
      
      return { ...fields, [namespacedKey]: fieldValue };
    }
    return fields;
  }, {});
};

/**
 * Returns props for custom user fields
 * @param {*} userFieldsConfig Configuration for user fields
 * @param {*} intl
 * @param {*} userType User type to restrict fields to. If none is passed,
 * only user fields applying to all user types are returned.
 * @param {*} isSignup Optional flag to determine whether the target context
 * is a signup form. Defaults to true.
 * @returns an array of props for CustomExtendedDataField: key, name,
 * fieldConfig, defaultRequiredMessage
 */
export const getPropsForCustomUserFieldInputs = (
  userFieldsConfig,
  intl,
  userType = null,
  isSignup = true
) => {
  return (
    userFieldsConfig?.reduce((pickedFields, fieldConfig) => {
      const { key, userTypeConfig, schemaType, scope, saveConfig = {} } = fieldConfig || {};
      const namespacedKey = addScopePrefix(scope, key);
      const showField = isSignup ? saveConfig.displayInSignUp : true;

      const isKnownSchemaType = EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType);
      const isTargetUserType =
        !userTypeConfig?.limitToUserTypeIds || userTypeConfig?.userTypeIds?.includes(userType);
      const isUserScope = ['public', 'private', 'protected'].includes(scope);

      return isKnownSchemaType && isTargetUserType && isUserScope && showField
        ? [
            ...pickedFields,
            {
              key: namespacedKey,
              name: namespacedKey,
              fieldConfig: fieldConfig,
              defaultRequiredMessage: intl.formatMessage({
                id: 'CustomExtendedDataField.required',
              }),
            },
          ]
        : pickedFields;
    }, []) || []
  );
};

/**
 * Check if currentUser has permission to post listings.
 * Defined in currentUser's effectivePermissionSet relationship:
 * https://www.sharetribe.com/api-reference/marketplace.html#currentuser-permissionset
 *
 * @param {Object} currentUser API entity
 * @returns {Boolean} true if currentUser has permission to post listings.
 */
export const hasPermissionToPostListings = currentUser => {
  if (currentUser?.id && !currentUser?.effectivePermissionSet?.id) {
    console.warn(
      '"effectivePermissionSet" relationship is not defined or included to the fetched currentUser entity.'
    );
  }
  return currentUser?.effectivePermissionSet?.attributes?.postListings === 'permission/allow';
};

/**
 * Check if currentUser has permission to initiate transactions.
 * Defined in currentUser's effectivePermissionSet relationship:
 * https://www.sharetribe.com/api-reference/marketplace.html#currentuser-permissionset
 *
 * @param {Object} currentUser API entity
 * @returns {Boolean} true if currentUser has permission to initiate transactions.
 */
export const hasPermissionToInitiateTransactions = currentUser => {
  if (currentUser?.id && !currentUser?.effectivePermissionSet?.id) {
    console.warn(
      '"effectivePermissionSet" relationship is not defined or included to the fetched currentUser entity.'
    );
  }
  return (
    currentUser?.effectivePermissionSet?.attributes?.initiateTransactions === 'permission/allow'
  );
};

/**
 * Check if currentUser has permission to view listing and user data on a private marketplace.
 * Defined in currentUser's effectivePermissionSet relationship:
 * https://www.sharetribe.com/api-reference/marketplace.html#currentuser-permissionset
 *
 * @param {Object} currentUser API entity
 * @returns {Boolean} true if currentUser has permission to view listing and user data on a private marketplace.
 */
export const hasPermissionToViewData = currentUser => {
  if (currentUser?.id && !currentUser?.effectivePermissionSet?.id) {
    console.warn(
      '"effectivePermissionSet" relationship is not defined or included to the fetched currentUser entity.'
    );
  }
  return currentUser?.effectivePermissionSet?.attributes?.read === 'permission/allow';
};

/**
 * Check if currentUser has been approved to gain access.
 * I.e. they are not in 'pending-approval' or 'banned' state.
 *
 * If the user is in 'pending-approval' state, they don't have right to post listings and initiate transactions.
 *
 * @param {Object} currentUser API entity.
 * @returns {Boolean} true if currentUser has been approved (state is 'active').
 */
export const isUserAuthorized = currentUser => currentUser?.attributes?.state === 'active';

/**
 * Get the user type configuration for the current user's user type
 * @param {*} config marketplace configuration
 * @param {*} currentUser API entity
 * @returns a single user type configuration, if found
 */
const getCurrentUserTypeConfig = (config, currentUser) => {
  const { userTypes } = config.user;
  return userTypes.find(
    ut => ut.userType === currentUser?.attributes?.profile?.publicData?.userType
  );
};

/**
 * Check if the links for creating a new listing should be shown to the
 * user currently browsing the marketplace.
 * @param {Object} config Marketplace configuration
 * @param {Object} currentUser API entity
 * @returns {Boolean} true if the currentUser's user type, or the anonymous user configuration, is set to see the link
 */
export const showCreateListingLinkForUser = (config, currentUser) => {
  const { topbar } = config;
  const currentUserTypeConfig = getCurrentUserTypeConfig(config, currentUser);

  // CRITICAL BUSINESS LOGIC:
  // ⚠️ FINAL ROLE MAPPING (matching Console permissions):
  // - userType 'provider' (Заказчик) → roles: {customer: true, provider: false} → CAN create listings
  // - userType 'customer' (Исполнитель) → roles: {customer: false, provider: true} → CANNOT create listings
  const userRoles = getCurrentUserTypeRoles(config, currentUser);
  
  // User without 'customer' role CANNOT create listings
  if (!userRoles.customer) {
    console.log('🚫 User does not have customer role - hiding create listing link');
    return false; // Only users with customer role can create listings
  }

  const { accountLinksVisibility } = currentUserTypeConfig || {};

  return currentUser && accountLinksVisibility
    ? accountLinksVisibility.postListings
    : currentUser
    ? true
    : topbar?.postListingsLink
    ? topbar.postListingsLink.showToUnauthenticatedUsers
    : true;
};

/**
 * Check if payout details tab and payout methods tab should be shown for the user
 * @param {Object} config Marketplace configuration
 * @param {*} currentUser API entity
 * @returns {Object} { showPayoutDetails: Boolean, showPaymentMethods: boolean }
 */
export const showPaymentDetailsForUser = (config, currentUser) => {
  if (!currentUser) {
    return null;
  }

  // Business requirement: скрываем вкладки выплат и методов оплаты
  return {
    showPayoutDetails: false,
    showPaymentMethods: false,
  };
};

/**
 * Check the roles defined for the current user
 * @param {*} config Marketplace configuration
 * @param {*} currentUser API entity
 * @returns Object with attributes 'customer' and 'provider' and boolean values for each
 */
export const getCurrentUserTypeRoles = (config, currentUser) => {
  const currentUserTypeConfig = getCurrentUserTypeConfig(config, currentUser);
  return (
    currentUserTypeConfig?.roles || {
      customer: true,
      provider: true,
    }
  );
};
