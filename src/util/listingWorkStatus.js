/**
 * Состояние работы по заданию — только по publicData самого задания.
 *
 * Правила должны совпадать с MyListingsScreen в YouDuMobile, иначе сайт и
 * приложение покажут заказчику разные статусы: отмена важнее завершения,
 * завершение важнее выбранного исполнителя. Сделки сюда не подмешиваются:
 * принятая сделка остаётся и после «Сменить исполнителя», а у завершённого
 * задания hired так и остаётся true.
 *
 * @param {Object} publicData
 * @returns {'cancelled' | 'completed' | 'in-progress' | 'open'}
 */
export const listingWorkStatus = publicData => {
  const data = publicData || {};

  if (data.cancelled === true || data.status === 'cancelled') {
    return 'cancelled';
  }
  if (data.status === 'completed') {
    return 'completed';
  }
  // «Сменить исполнителя» ставит status: 'open'; он важнее старых полей исполнителя.
  if (data.status === 'open') {
    return 'open';
  }
  if (data.status === 'in-progress' || data.hired === true || !!data.assignedTo) {
    return 'in-progress';
  }
  return 'open';
};
