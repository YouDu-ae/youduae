/**
 * Transaction process graph for assignment flow:
 *   - assignment-flow-v3
 * 
 * Custom process for YouDo-like marketplace:
 * Customer posts a task → Providers make offers → Customer selects provider → Provider completes work
 */

/**
 * Transitions
 *
 * These strings must sync with values defined in Marketplace API,
 * since transaction objects given by API contain info about last transitions.
 */

export const transitions = {
  // Provider sends an offer (with price and comment)
  INQUIRE: 'transition/inquire',
  
  // Customer accepts provider's offer
  ACCEPT_OFFER: 'transition/accept-offer',
  
  // Customer declines provider's offer
  DECLINE_OFFER: 'transition/decline-offer',
  
  // Provider marks work as complete
  COMPLETE: 'transition/complete',
  
  // Review transitions
  REVIEW_1_BY_CUSTOMER: 'transition/review-1-by-customer',
  REVIEW_1_BY_PROVIDER: 'transition/review-1-by-provider',
  REVIEW_2_BY_CUSTOMER: 'transition/review-2-by-customer',
  REVIEW_2_BY_PROVIDER: 'transition/review-2-by-provider',
  EXPIRE_REVIEW_PERIOD: 'transition/expire-review-period',
  EXPIRE_CUSTOMER_REVIEW_PERIOD: 'transition/expire-customer-review-period',
  EXPIRE_PROVIDER_REVIEW_PERIOD: 'transition/expire-provider-review-period',
};

/**
 * States
 *
 * These constants are only for making it clear how transitions work together.
 */
export const states = {
  INITIAL: 'initial',
  INQUIRY: 'inquiry',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  COMPLETED: 'completed',
  REVIEWED_BY_CUSTOMER: 'reviewed-by-customer',
  REVIEWED_BY_PROVIDER: 'reviewed-by-provider',
  REVIEWED: 'reviewed',
};

/**
 * Description of transaction process graph
 *
 * You should keep this in sync with transaction process defined in Marketplace API
 */
export const graph = {
  // id is defined only to support Xstate format.
  id: 'assignment-flow-v3/release-1',

  // This 'initial' state is a starting point for new transaction
  initial: states.INITIAL,

  // States
  states: {
    [states.INITIAL]: {
      on: {
        [transitions.INQUIRE]: states.INQUIRY,
      },
    },
    [states.INQUIRY]: {
      on: {
        [transitions.ACCEPT_OFFER]: states.ACCEPTED,
        [transitions.DECLINE_OFFER]: states.DECLINED,
      },
    },
    [states.DECLINED]: { type: 'final' },
    [states.ACCEPTED]: {
      on: {
        [transitions.COMPLETE]: states.COMPLETED,
      },
    },
    [states.COMPLETED]: {
      on: {
        [transitions.EXPIRE_REVIEW_PERIOD]: states.REVIEWED,
        [transitions.REVIEW_1_BY_CUSTOMER]: states.REVIEWED_BY_CUSTOMER,
        [transitions.REVIEW_1_BY_PROVIDER]: states.REVIEWED_BY_PROVIDER,
      },
    },
    [states.REVIEWED_BY_CUSTOMER]: {
      on: {
        [transitions.REVIEW_2_BY_PROVIDER]: states.REVIEWED,
        [transitions.EXPIRE_PROVIDER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED_BY_PROVIDER]: {
      on: {
        [transitions.REVIEW_2_BY_CUSTOMER]: states.REVIEWED,
        [transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED]: { type: 'final' },
  },
};

// Check if a transition is the kind that should be rendered
// when showing transition history (e.g. ActivityFeed)
export const isRelevantPastTransition = transition => {
  return [
    transitions.INQUIRE,
    transitions.ACCEPT_OFFER,
    transitions.DECLINE_OFFER,
    transitions.COMPLETE,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
  ].includes(transition);
};

// Check if transition is a customer review
export const isCustomerReview = transition => {
  return [
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_2_BY_CUSTOMER,
  ].includes(transition);
};

// Check if transition is a provider review
export const isProviderReview = transition => {
  return [
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_PROVIDER,
  ].includes(transition);
};

// Check if the given transition is privileged.
// Privileged transitions need to be handled from backend.
export const isPrivileged = transition => {
  return [
    transitions.INQUIRE,
    transitions.ACCEPT_OFFER,
    transitions.DECLINE_OFFER,
  ].includes(transition);
};

// Check when transaction is completed (including review states)
export const isCompleted = transition => {
  const completedTransitions = [
    transitions.COMPLETE,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
    transitions.EXPIRE_REVIEW_PERIOD,
    transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD,
    transitions.EXPIRE_PROVIDER_REVIEW_PERIOD,
  ];
  return completedTransitions.includes(transition);
};

// Not used in this process
export const isRefunded = transition => {
  return false;
};

// States where provider needs to take action
// Provider должен завершить работу после того как его приняли
export const statesNeedingProviderAttention = [states.ACCEPTED];

// States where customer needs to take action
// Customer должен увидеть новые отклики (inquiries) и когда его выбрали (accepted)
export const statesNeedingCustomerAttention = [states.INQUIRY, states.ACCEPTED];

// Get transitions that lead to specific state(s)
export const getTransitionsToStates = stateNames => {
  const allTransitions = Object.values(transitions);
  const result = [];
  
  stateNames.forEach(stateName => {
    switch (stateName) {
      case states.INQUIRY:
        result.push(transitions.INQUIRE);
        break;
      case states.ACCEPTED:
        result.push(transitions.ACCEPT_OFFER);
        break;
      case states.COMPLETED:
        result.push(transitions.COMPLETE);
        break;
      case states.REVIEWED_BY_CUSTOMER:
        result.push(transitions.REVIEW_1_BY_CUSTOMER);
        break;
      case states.REVIEWED_BY_PROVIDER:
        result.push(transitions.REVIEW_1_BY_PROVIDER);
        break;
      case states.REVIEWED:
        result.push(
          transitions.REVIEW_2_BY_CUSTOMER,
          transitions.REVIEW_2_BY_PROVIDER,
          transitions.EXPIRE_REVIEW_PERIOD,
          transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD,
          transitions.EXPIRE_PROVIDER_REVIEW_PERIOD
        );
        break;
      default:
        break;
    }
  });
  
  return result;
};

// Get current state from transaction object
export const getState = tx => {
  const currentTransition = tx?.attributes?.lastTransition;
  
  // eslint-disable-next-line no-console
  console.log('🔍 getState: currentTransition =', currentTransition);
  
  // Map transitions to states
  if (!currentTransition) {
    return states.INITIAL;
  }
  
  let resultState;
  switch (currentTransition) {
    case transitions.INQUIRE:
      resultState = states.INQUIRY;
      break;
    case transitions.ACCEPT_OFFER:
      resultState = states.ACCEPTED;
      break;
    case transitions.DECLINE_OFFER:
      resultState = states.DECLINED;
      break;
    case transitions.COMPLETE:
      resultState = states.COMPLETED;
      break;
    case transitions.REVIEW_1_BY_CUSTOMER:
      resultState = states.REVIEWED_BY_CUSTOMER;
      break;
    case transitions.REVIEW_1_BY_PROVIDER:
      resultState = states.REVIEWED_BY_PROVIDER;
      break;
    case transitions.REVIEW_2_BY_CUSTOMER:
    case transitions.REVIEW_2_BY_PROVIDER:
    case transitions.EXPIRE_REVIEW_PERIOD:
    case transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD:
    case transitions.EXPIRE_PROVIDER_REVIEW_PERIOD:
      resultState = states.REVIEWED;
      break;
    default:
      resultState = states.INITIAL;
  }
  
  // eslint-disable-next-line no-console
  console.log('  → resultState =', resultState);
  
  return resultState;
};

