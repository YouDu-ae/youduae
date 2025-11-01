import { 
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD, 
  ConditionalResolver 
} from '../../transactions/transaction';

// Get UI data mapped to specific transaction state & role for assignment process
export const getStateDataForAssignmentProcess = (txInfo, processInfo) => {
  const { transactionRole } = txInfo;
  const { processName, processState, states } = processInfo;
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.INQUIRY, CUSTOMER], () => {
      // Customer видит новый оффер от Provider - показываем красную точку
      return { processName, processState, actionNeeded: true, isSaleNotification: true };
    })
    .cond([states.INQUIRY, PROVIDER], () => {
      // Provider отправил оффер и ждёт ответа
      return { processName, processState, actionNeeded: false };
    })
    .cond([states.ACCEPTED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.DECLINED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.COMPLETED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .default(() => {
      // Default values for other states
      return { processName, processState };
    })
    .resolve();
};
