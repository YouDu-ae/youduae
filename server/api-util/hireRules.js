/**
 * Whom a task author may still hire, and with whom the work may be completed.
 *
 * Neither can be read off the deal any more. «Сменить исполнителя» leaves the
 * removed specialist's deal accepted, as assignment-flow-v3 has no way back
 * from state/accepted, and the other offers stay pending while somebody works
 * on the task so that a change of executor can return to them. The task's
 * public data is what says how things stand.
 */

const uuidOf = ref => ref?.id?.uuid || ref?.uuid || ref || null;

/** Specialists taken off the task with «Сменить исполнителя», for good. */
const removedSpecialists = publicData =>
  Array.isArray(publicData?.excludedOfferCustomerIds) ? publicData.excludedOfferCustomerIds : [];

// Mirrors listingWorkStatus in src/util/listingWorkStatus.js.
const workStatus = (publicData = {}) => {
  if (publicData.cancelled === true || publicData.status === 'cancelled') return 'cancelled';
  if (publicData.status === 'completed') return 'completed';
  if (publicData.status === 'open') return 'open';
  if (publicData.status === 'in-progress' || publicData.hired === true || !!publicData.assignedTo) {
    return 'in-progress';
  }
  return 'open';
};

const REFUSAL_MESSAGES = {
  specialist_removed: 'Этого специалиста сняли с задания, выбрать его снова нельзя.',
  executor_already_chosen:
    'У задания уже есть исполнитель. Чтобы выбрать другого, сначала смените исполнителя.',
  task_cancelled: 'Задание отменено.',
  removed_executor_deal:
    'Этого исполнителя сняли с задания. Завершить задание можно только с текущим исполнителем.',
};

/** Why the offer in this deal cannot be accepted, or null when it can. */
const hireRefusal = ({ publicData, specialistId }) => {
  if (specialistId && removedSpecialists(publicData).includes(specialistId)) {
    return 'specialist_removed';
  }
  const status = workStatus(publicData);
  if (status === 'cancelled') return 'task_cancelled';
  if (status !== 'open') return 'executor_already_chosen';
  return null;
};

/** Why the work in this deal cannot be marked done, or null when it can. */
const completeRefusal = ({ publicData, specialistId }) =>
  specialistId && removedSpecialists(publicData).includes(specialistId)
    ? 'removed_executor_deal'
    : null;

// Sharetribe returns relationships only for what `include` names.
const DEAL_INCLUDE = ['listing', 'customer'];

/**
 * The task and the specialist of a deal, from a transactions.show response
 * made with DEAL_INCLUDE.
 */
const taskOfDeal = response => {
  const transaction = response?.data?.data;
  const listingId = uuidOf(transaction?.relationships?.listing?.data?.id);
  const listing = (response?.data?.included || []).find(
    entry => entry.type === 'listing' && uuidOf(entry.id) === listingId
  );
  return {
    listingId,
    specialistId: uuidOf(transaction?.relationships?.customer?.data?.id),
    publicData: listing?.attributes?.publicData || {},
  };
};

module.exports = {
  DEAL_INCLUDE,
  REFUSAL_MESSAGES,
  completeRefusal,
  hireRefusal,
  removedSpecialists,
  taskOfDeal,
  workStatus,
};
