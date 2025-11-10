// src/components/OfferList.jsx
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  transitionPrivileged,
  queryOffers,
  updateListingStatus,
  getUserReviewsStats,
} from '../util/api';
import StarRating from './StarRating/StarRating';
import { NamedLink, Avatar, VerificationBadge } from '../components';

import css from './OfferList.module.css';
import { trackProviderSelected } from '../analytics/plausibleEvents';

/**
 * Helper: извлекает связанные сущности из included массива
 * @param {Object} transaction - транзакция
 * @param {Array} included - массив included из API ответа
 * @param {string} relationshipName - имя relationship (например, 'customer')
 * @returns {Object|null} - найденная сущность или null
 */
const getIncludedEntity = (transaction, included, relationshipName) => {
  if (!transaction?.relationships?.[relationshipName]) {
    return null;
  }
  
  const relationshipData = transaction.relationships[relationshipName].data;
  if (!relationshipData || !relationshipData.id) {
    return null;
  }
  
  const entityId = relationshipData.id.uuid;
  return included?.find(item => item.id.uuid === entityId) || null;
};

/**
 * Helper: связывает profileImage с user объектом
 * @param {Object} user - объект пользователя
 * @param {Array} included - массив included из API ответа
 * @returns {Object} - user с добавленным profileImage
 */
const attachProfileImage = (user, included) => {
  if (!user || !included) {
    return user;
  }
  
  // Проверяем, есть ли relationship к profileImage
  const profileImageRelationship = user.relationships?.profileImage?.data;
  if (!profileImageRelationship) {
    return user;
  }
  
  // Ищем image в included массиве
  const profileImageId = profileImageRelationship.id?.uuid;
  const profileImage = included.find(
    item => item.type === 'image' && item.id.uuid === profileImageId
  );
  
  if (profileImage) {
    return {
      ...user,
      profileImage,
    };
  }
  
  return user;
};

/**
 * Список откликов по объявлению (видит только владелец листинга).
 * Показывает цену/комментарий и позволяет выбрать исполнителя.
 */
export default function OfferList({ listingId, isOwner }) {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [included, setIncluded] = useState([]); // Сохраняем included массив
  const [reviewsStats, setReviewsStats] = useState({}); // { userId: { rating, reviewCount } }
  const [err, setErr] = useState(null);
  const [busyTxId, setBusyTxId] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    const loadOffers = async () => {
      // ✅ ВАЖНО: Загружаем транзакции ТОЛЬКО если это владелец
      if (!listingId || !isOwner) {
        console.log('🔍 OfferList: skipping load', { listingId, isOwner });
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr(null);
      try {
        console.log('🔍 OfferList: loading offers for listing', listingId);
        
        // Используем серверный API endpoint вместо прямого SDK вызова
        const response = await queryOffers(listingId);
        
        console.log('✅ OfferList: loaded', response.data.data.length, 'offers');
        console.log('🔍 Full response:', response);
        console.log('🔍 response.data:', response.data);
        console.log('🔍 response.data.included:', response.data.included);
        
        // Проверяем первую транзакцию
        if (response.data.data.length > 0) {
          const firstTx = response.data.data[0];
          console.log('🔍 First transaction (client):', {
            id: firstTx.id,
            customer: firstTx.customer,
            relationships: firstTx.relationships,
            attributes: firstTx.attributes,
          });
        }
        
        // Сохраняем и offers, и included массив
        const offersData = response.data.data || [];
        const includedData = response.data.included || [];
        
        setOffers(offersData);
        setIncluded(includedData);
        
        // Загружаем статистику отзывов для всех customers
        // Сначала извлекаем уникальные customer IDs
        const customerIds = new Set();
        offersData.forEach(tx => {
          // Пытаемся найти customer ID в relationships
          const customerId = tx.relationships?.customer?.data?.id?.uuid;
          if (customerId) {
            customerIds.add(customerId);
          }
        });
        
        console.log('🔍 Loading reviews stats for', customerIds.size, 'customers');
        
        // Загружаем статистику параллельно для всех customers
        const statsPromises = Array.from(customerIds).map(async customerId => {
          try {
            const statsResponse = await getUserReviewsStats(customerId);
            return {
              userId: customerId,
              stats: statsResponse.data,
            };
          } catch (error) {
            console.error('Failed to load stats for user', customerId, error);
            return {
              userId: customerId,
              stats: { reviewCount: 0, averageRating: 0 },
            };
          }
        });
        
        const statsResults = await Promise.all(statsPromises);
        
        // Преобразуем в объект { userId: stats }
        const statsMap = {};
        statsResults.forEach(result => {
          statsMap[result.userId] = result.stats;
        });
        
        console.log('✅ Loaded reviews stats:', statsMap);
        setReviewsStats(statsMap);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('❌ OfferList query error:', e?.status, e?.data || e);
        setErr(
          'Не удалось загрузить отклики. ' +
            (e?.status === 401 ? 'Войдите снова.' : 'Обновите страницу.')
        );
      } finally {
        setLoading(false);
      }
    };

    loadOffers();
  }, [listingId, isOwner, reloadTrigger]);

  if (!isOwner) return null;

  const accept = async tx => {
    setBusyTxId(tx.id.uuid);
    setErr(null);
    try {
      console.log('🔍 OfferList: accepting offer, tx =', tx.id.uuid);
      const offerData = tx?.attributes?.protectedData?.offer || {};
      
      // Используем серверный API для privileged transition
      const body = {
        isSpeculative: false,
        orderData: {},
        bodyParams: {
          id: tx.id,
          transition: 'transition/accept-offer',
          params: {}, // Для transitions params обычно пустой
        },
        queryParams: {},
      };

      await transitionPrivileged(body);
      
      console.log('✅ OfferList: offer accepted, updating listing status...');
      
      // Обновляем статус листинга - помечаем как "в работе"
      const customerId = tx.customer?.id?.uuid;
      await updateListingStatus({
        listingId,
        assignedTo: customerId,
        status: 'in-progress',
      });

      trackProviderSelected({
        listingId,
        transactionId: tx.id?.uuid || tx.id,
        providerId: customerId,
        priceAmount: offerData?.price,
        priceCurrency: offerData?.currency,
      });
      
      console.log('✅ OfferList: listing status updated');
      // Перезагружаем список откликов
      setReloadTrigger(prev => prev + 1);
      
      // Перезагружаем страницу чтобы обновить UI
      window.location.reload();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('❌ OfferList accept error:', e?.status, e?.data || e);
      const errorMessage = e?.data?.errors?.[0]?.title || e?.message || 'Неизвестная ошибка';
      setErr(`Не удалось выбрать исполнителя: ${errorMessage}`);
    } finally {
      setBusyTxId(null);
    }
  };

  const decline = async tx => {
    if (!window.confirm('Вы уверены, что хотите отклонить этот отклик?')) {
      return;
    }

    setBusyTxId(tx.id.uuid);
    setErr(null);
    try {
      console.log('🔍 OfferList: declining offer, tx =', tx.id.uuid);
      
      // Используем серверный API для privileged transition
      const body = {
        isSpeculative: false,
        orderData: {},
        bodyParams: {
          id: tx.id,
          transition: 'transition/decline-offer',
          params: {},
        },
        queryParams: {},
      };

      await transitionPrivileged(body);
      
      console.log('✅ OfferList: offer declined');
      // Перезагружаем список откликов
      setReloadTrigger(prev => prev + 1);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('❌ OfferList decline error:', e?.status, e?.data || e);
      const errorMessage = e?.data?.errors?.[0]?.title || e?.message || 'Неизвестная ошибка';
      setErr(`Не удалось отклонить отклик: ${errorMessage}`);
    } finally {
      setBusyTxId(null);
    }
  };

  if (loading) return <div>Загрузка откликов…</div>;
  if (err) return <div style={{ color: 'crimson' }}>{err}</div>;
  if (!offers.length) return <div>Пока нет откликов</div>;

  /**
   * Функция сортировки откликов с приоритетом верифицированным пользователям
   * Приоритет:
   * 1. ✅ Верифицированные пользователи ВСЕГДА выше неверифицированных (независимо от отзывов)
   * 2. Среди верифицированных: больше отзывов = выше
   * 3. Среди неверифицированных: больше отзывов = выше
   * 4. При равном количестве отзывов: выше рейтинг = выше
   */
  const sortedOffers = [...offers].sort((txA, txB) => {
    // Извлекаем customer для каждого отклика
    let customerA = txA.customer;
    if (!customerA || !customerA.attributes) {
      customerA = getIncludedEntity(txA, included, 'customer');
    }
    
    let customerB = txB.customer;
    if (!customerB || !customerB.attributes) {
      customerB = getIncludedEntity(txB, included, 'customer');
    }
    
    // Проверяем статус верификации
    // ✅ Обрабатываем два формата: boolean или объект {isVerified: true}
    const publicDataA = customerA?.attributes?.profile?.publicData;
    const publicDataB = customerB?.attributes?.profile?.publicData;
    
    const isVerifiedValueA = publicDataA?.isVerified;
    const isVerifiedValueB = publicDataB?.isVerified;
    
    const isVerifiedA = 
      isVerifiedValueA === true || 
      (typeof isVerifiedValueA === 'object' && isVerifiedValueA?.isVerified === true);
    
    const isVerifiedB = 
      isVerifiedValueB === true || 
      (typeof isVerifiedValueB === 'object' && isVerifiedValueB?.isVerified === true);
    
    // Получаем статистику отзывов
    const customerIdA = customerA?.id?.uuid;
    const customerIdB = customerB?.id?.uuid;
    
    const customerNameA = customerA?.attributes?.profile?.displayName || 'Unknown';
    const customerNameB = customerB?.attributes?.profile?.displayName || 'Unknown';
    
    const statsA = customerIdA ? reviewsStats[customerIdA] : null;
    const statsB = customerIdB ? reviewsStats[customerIdB] : null;
    
    const reviewCountA = statsA?.reviewCount || 0;
    const reviewCountB = statsB?.reviewCount || 0;
    
    const ratingA = statsA?.averageRating || 0;
    const ratingB = statsB?.averageRating || 0;
    
    console.log('🔍 Comparing:', {
      A: { 
        name: customerNameA, 
        verified: isVerifiedA, 
        verifiedValue: isVerifiedValueA,
        reviews: reviewCountA, 
        rating: ratingA 
      },
      B: { 
        name: customerNameB, 
        verified: isVerifiedB, 
        verifiedValue: isVerifiedValueB,
        reviews: reviewCountB, 
        rating: ratingB 
      },
    });
    
    // 1. ✅ ПРИОРИТЕТ: Верифицированные ВСЕГДА выше неверифицированных
    if (isVerifiedA && !isVerifiedB) {
      console.log('  → A verified, B not: A wins');
      return -1; // A выше
    }
    if (!isVerifiedA && isVerifiedB) {
      console.log('  → B verified, A not: B wins');
      return 1;  // B выше
    }
    
    // 2. Если оба верифицированы (или оба нет), сортируем по количеству отзывов
    if (reviewCountA !== reviewCountB) {
      console.log(`  → Same verification status, different reviews: ${reviewCountB > reviewCountA ? 'B' : 'A'} wins`);
      return reviewCountB - reviewCountA; // Больше отзывов = выше
    }
    
    // 3. Если количество отзывов одинаковое, сортируем по рейтингу
    if (ratingA !== ratingB) {
      console.log(`  → Same reviews, different rating: ${ratingB > ratingA ? 'B' : 'A'} wins`);
      return ratingB - ratingA; // Выше рейтинг = выше
    }
    
    // 4. Если всё равно, сохраняем исходный порядок (по времени отклика)
    console.log('  → Equal, keeping original order');
    return 0;
  });

  // Логируем итоговый порядок после сортировки
  console.log('✅ Final sorted order:');
  sortedOffers.forEach((tx, index) => {
    let customer = tx.customer;
    if (!customer || !customer.attributes) {
      customer = getIncludedEntity(tx, included, 'customer');
    }
    const customerName = customer?.attributes?.profile?.displayName || 'Unknown';
    const isVerified = customer?.attributes?.profile?.publicData?.isVerified === true;
    const customerId = customer?.id?.uuid;
    const stats = customerId ? reviewsStats[customerId] : null;
    const reviewCount = stats?.reviewCount || 0;
    const rating = stats?.averageRating || 0;
    
    console.log(`  ${index + 1}. ${customerName} - Verified: ${isVerified ? '✅' : '❌'}, Reviews: ${reviewCount}, Rating: ${rating.toFixed(1)}`);
  });

  // ✅ НОВАЯ ЛОГИКА: Если есть принятый оффер - показываем ТОЛЬКО его
  const acceptedOffer = sortedOffers.find(tx => tx.attributes?.lastTransition === 'transition/accept-offer');
  const offersToDisplay = acceptedOffer ? [acceptedOffer] : sortedOffers;
  
  console.log('🔍 Accepted offer:', acceptedOffer ? 'YES' : 'NO');
  console.log('🔍 Offers to display:', offersToDisplay.length);

  return (
    <div>
      <h3 style={{ marginTop: 24, marginBottom: 12, fontSize: '16px' }}>Отклики исполнителей</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {offersToDisplay.map(tx => {
          const offer = tx.attributes?.protectedData?.offer || {};
          const accepted = tx.attributes?.lastTransition === 'transition/accept-offer';
          const price = offer.price;
          const currency = offer.currency || 'AED';
          const comment = offer.comment;

          // Извлекаем информацию о customer (исполнителе)
          // Сначала пробуем взять из tx.customer, если SDK денормализовал
          // Если нет - извлекаем из included массива
          let customer = tx.customer;
          if (!customer || !customer.attributes) {
            customer = getIncludedEntity(tx, included, 'customer');
          }
          
          // Привязываем profileImage к customer
          if (customer) {
            customer = attachProfileImage(customer, included);
          }
          
          const customerProfile = customer?.attributes?.profile || {};
          const customerName = customerProfile.displayName || 'Исполнитель';
          const customerId = customer?.id?.uuid;
          
          // ✅ ДЕТАЛЬНАЯ ПРОВЕРКА ВЕРИФИКАЦИИ
          const publicData = customerProfile?.publicData || {};
          
          // ✅ Обрабатываем два формата:
          // 1. publicData.isVerified = true (правильный)
          // 2. publicData.isVerified = {isVerified: true} (вложенный объект)
          const isVerifiedValue = publicData?.isVerified;
          const isVerified = 
            isVerifiedValue === true || 
            (typeof isVerifiedValue === 'object' && isVerifiedValue?.isVerified === true);
          
          // 🔍 ДЕБАГ: Логируем данные верификации
          if (isVerifiedValue) {
            console.log('✅ VERIFIED USER FOUND:', customerName);
            console.log('  - isVerifiedValue:', isVerifiedValue);
            console.log('  - isVerified (computed):', isVerified);
            console.log('  - Type of isVerifiedValue:', typeof isVerifiedValue);
          }
          
          // Получаем статистику отзывов из загруженных данных
          const userStats = customerId ? reviewsStats[customerId] : null;
          const rating = userStats?.averageRating || 0;
          const reviewCount = userStats?.reviewCount || 0;


          return (
            <li
              key={tx.id.uuid}
              className={classNames(css.offerCard, {
                [css.offerCardAccepted]: accepted,
              })}
            >
              {/* Header с аватаром и именем */}
              <div className={css.executorHeader}>
                {/* Аватар исполнителя */}
                {customer && (
                  <Avatar
                    className={css.avatar}
                    user={customer}
                    renderSizes="(max-width: 767px) 40px, 48px"
                  />
                )}
                
                {/* Имя исполнителя со ссылкой на профиль */}
                <div className={css.executorName}>
                  {customerId ? (
                    <NamedLink
                      name="ProfilePage"
                      params={{ id: customerId }}
                      className={css.profileLink}
                    >
                      {customerName}
                    </NamedLink>
                  ) : (
                    customerName
                  )}
                  {(() => {
                    console.log(`🎯 Rendering VerificationBadge for ${customerName}:`, {
                      isVerified,
                      type: typeof isVerified,
                      willRender: isVerified === true
                    });
                    return <VerificationBadge isVerified={isVerified} />;
                  })()}
                </div>
              </div>

              {/* Рейтинг и количество отзывов */}
              <div className={css.ratingContainer}>
                {rating > 0 ? (
                  <>
                    <StarRating rating={rating} />
                    <span className={css.ratingText}>
                      {rating.toFixed(1)} ({reviewCount}{' '}
                      {reviewCount === 1
                        ? 'отзыв'
                        : reviewCount < 5
                        ? 'отзыва'
                        : 'отзывов'}
                      )
                    </span>
                  </>
                ) : (
                  <span className={css.noRatingText}>Пока нет отзывов</span>
                )}
              </div>

              {/* Цена */}
              <div className={css.priceLabel}>
                Предложенная цена:{' '}
                {price !== undefined && price !== null ? `${price} ${currency}` : '—'}
              </div>

              {/* Комментарий */}
              <div className={css.commentLabel}>Комментарий: {comment ? comment : '—'}</div>

              {/* Кнопки выбора/отклонения */}
              {!accepted ? (
                <div className={css.buttonGroup}>
                  <button
                    onClick={() => accept(tx)}
                    disabled={busyTxId === tx.id.uuid}
                    className={css.selectButton}
                  >
                    {busyTxId === tx.id.uuid ? 'Выбираю…' : 'Выбрать исполнителя'}
                  </button>
                  <button
                    onClick={() => decline(tx)}
                    disabled={busyTxId === tx.id.uuid}
                    className={css.declineButton}
                  >
                    {busyTxId === tx.id.uuid ? 'Отклоняю…' : 'Отклонить'}
                  </button>
                </div>
              ) : (
                <div className={css.acceptedSection}>
                  <div className={css.acceptedLabel}>✅ Исполнитель выбран</div>
                  <NamedLink
                    name="SaleDetailsPage"
                    params={{ id: tx.id.uuid }}
                    className={css.chatButton}
                  >
                    💬 Перейти в чат
                  </NamedLink>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

OfferList.propTypes = {
  listingId: PropTypes.string.isRequired,
  isOwner: PropTypes.bool,
};