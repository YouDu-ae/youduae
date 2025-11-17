// src/components/OfferForm.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { initiatePrivileged, checkMyOffer } from '../util/api';
import { NamedLink } from '../components';
import { trackOfferSubmitted } from '../analytics/plausibleEvents';
import css from './OfferForm.module.css';

/**
 * Форма отклика на листинг.
 * Создаёт новую сделку по нашему кастомному процессу и пишет предложение в protectedData.
 *
 * Требования:
 *  - listingId: UUID листинга (строка)
 *  - processAlias: 'assignment-flow-v3/release-1' (по умолчанию)
 *  - listingStatus: статус листинга (из publicData)
 *  - assignedTo: ID выбранного исполнителя (из publicData)
 *  - currentUserId: ID текущего пользователя
 *  - currentUser: Полный объект currentUser для проверки userType
 *  - isOnlyCustomer: Boolean флаг, может ли пользователь откликаться (только Customer роль)
 */
export default function OfferForm({
  listingId,
  processAlias = 'assignment-flow-v3/release-1',
  listingStatus,
  assignedTo,
  currentUserId,
  currentUser,
  isOnlyCustomer = false,
  category,
  city,
}) {
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(null);
  const [checking, setChecking] = useState(true);
  const [alreadySent, setAlreadySent] = useState(false);
  const [offerStatus, setOfferStatus] = useState(null); // pending, accepted, declined, completed
  const [transactionId, setTransactionId] = useState(null); // ID транзакции для ссылки на чат

  // Проверяем, не отправлял ли пользователь уже отклик на этот листинг
  useEffect(() => {
    const checkExistingOffer = async () => {
      try {
        const response = await checkMyOffer(listingId);
        const hasOffer = response?.data?.hasOffer || false;
        const status = response?.data?.offerStatus || null;
        const txId = response?.data?.transactionId || null;
        
        console.log('🔍 OfferForm: checking existing offer, hasOffer =', hasOffer, ', offerStatus =', status, ', transactionId =', txId);
        
        setAlreadySent(hasOffer);
        setOfferStatus(status);
        setTransactionId(txId);
      } catch (e) {
        console.error('❌ OfferForm: error checking existing offer:', e);
        // Если проверка не удалась, разрешаем отправить отклик
        setAlreadySent(false);
        setOfferStatus(null);
        setTransactionId(null);
      } finally {
        setChecking(false);
      }
    };

    checkExistingOffer();
  }, [listingId]);

  const onSubmit = async e => {
    e.preventDefault();
    setErr(null);
    setOk(false);

    const amount = Number(price);
    if (!amount || amount < 1) {
      setErr('Укажите корректную сумму');
      return;
    }
    if (!comment.trim()) {
      setErr('Добавьте комментарий');
      return;
    }

    setSubmitting(true);
    try {
      const currency = 'AED';
      
      console.log('🔍 OfferForm: initiating inquiry with data:', {
        processAlias,
        listingId,
        offer: { price: amount, currency, comment },
      });

      // Используем серверный endpoint для privileged transition
      // Сервер имеет trustedSdk и может записывать в protectedData
      const body = {
        isSpeculative: false,
        orderData: {
          quantity: 1, // Для unitType: 'item' требуется quantity
        },
        bodyParams: {
          processAlias,
          transition: 'transition/inquire',
          params: {
            listingId,
            protectedData: {
              offer: {
                price: amount,
                currency,
                comment: comment.trim(),
              },
            },
          },
        },
        queryParams: {},
      };

      console.log('🔍 OfferForm: calling server API with body:', body);

      const response = await initiatePrivileged(body);

      console.log('✅ OfferForm: inquiry sent successfully', response);
      trackOfferSubmitted({
        listingId,
        userId: currentUserId,
        priceAmount: amount,
        priceCurrency: currency,
        commentLength: comment.trim().length,
        hasComment: !!comment.trim(),
        processAlias,
        listingStatus,
        category,
        city,
      });
      setOk(true);
      setAlreadySent(true); // Блокируем повторную отправку
      setPrice('');
      setComment('');
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('❌ OfferForm error:', e2);
      const errorMessage = e2?.data?.errors?.[0]?.title || e2?.message || 'Неизвестная ошибка';
      setErr(`Не удалось отправить отклик: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ БЛОКИРОВКА: Неавторизованные или Provider не могут откликаться
  // Только пользователи с ролью Customer (isOnlyCustomer === true) могут откликаться
  if (!isOnlyCustomer) {
    const isAuthenticated = !!currentUser;
    
    return (
      <div className={css.blockMessage}>
        <div className={css.blockMessageTitle}>
          {isAuthenticated 
            ? 'Вы не можете откликнуться на это задание' 
            : 'Авторизуйтесь для отклика на задание'}
        </div>
        <p className={css.blockMessageText}>
          {isAuthenticated 
            ? 'Вы являетесь заказчиком (Provider). Только исполнители (Customer) могут откликаться на задания. Вы можете создавать свои задания в разделе "Мои задания".'
            : 'Вы не авторизованы и не можете откликнуться на задание. Только авторизованные пользователи (Специалисты) могут откликаться и предложить свою цену или принять текущую.'}
        </p>
      </div>
    );
  }

  // Показываем индикатор загрузки при проверке
  if (checking) {
    return <div className={css.loadingSpinner}>Проверка...</div>;
  }

  // Если пользователь уже отправил отклик, показываем сообщение
  if (alreadySent) {
    // Отклик отклонён
    if (offerStatus === 'declined') {
      return (
        <div className={css.errorMessage}>
          <strong>Отклик отклонён</strong>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            К сожалению, заказчик отклонил ваш отклик на это задание. Вы можете найти другие задания в разделе "Найти задания".
          </p>
        </div>
      );
    }
    
    // Отклик принят
    if (offerStatus === 'accepted') {
      return (
        <div className={css.successMessage}>
          <strong>Ваш отклик принят! 🎉</strong>
          <p style={{ marginTop: 8, marginBottom: 8 }}>
            Поздравляем! Заказчик выбрал вас для выполнения этого задания.
          </p>
          {transactionId && (
            <NamedLink
              name="OrderDetailsPage"
              params={{ id: transactionId }}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              💬 Перейти в чат
            </NamedLink>
          )}
        </div>
      );
    }
    
    // Работа завершена
    if (offerStatus === 'completed') {
      return (
        <div style={{ padding: 16, backgroundColor: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 4 }}>
          <strong style={{ color: '#1e3a8a' }}>Работа завершена</strong>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#1e40af' }}>
            Вы завершили выполнение этого задания. Вы можете оставить отзыв о заказчике в разделе "Входящие".
          </p>
        </div>
      );
    }
    
    // Проверяем, выбран ли другой исполнитель (для старых транзакций без offerStatus)
    const isAnotherExecutorChosen = 
      listingStatus === 'in-progress' && 
      assignedTo && 
      assignedTo !== currentUserId;
    
    if (isAnotherExecutorChosen) {
      // Выбран другой исполнитель
      return (
        <div style={{ padding: 16, backgroundColor: '#fff7ed', border: '1px solid #fb923c', borderRadius: 4 }}>
          <strong style={{ color: '#9a3412' }}>Выбран другой исполнитель</strong>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#78350f' }}>
            К сожалению, заказчик выбрал другого исполнителя для выполнения этого задания.
          </p>
        </div>
      );
    }
    
    // Заявка отправлена, ожидаем ответа (pending или неизвестный статус)
    return (
      <div style={{ padding: 16, backgroundColor: '#f0fff4', border: '1px solid #48bb78', borderRadius: 4 }}>
        <strong style={{ color: '#22543d' }}>Заявка отправлена!</strong>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#2d3748' }}>
          Дождитесь ответа от заказчика. Вы можете посмотреть статус вашего отклика в разделе "Входящие".
        </p>
      </div>
    );
  }

  return (
    <div className={css.root}>
      <h3 className={css.title}>Отправить отклик</h3>
      
      <form onSubmit={onSubmit}>
        <div className={css.inputGroup}>
          <label className={css.label}>
            Ваша цена (AED)
            <span className={css.required}>*</span>
          </label>
          <div className={css.priceInputContainer}>
            <span className={css.currencySymbol}>د.إ</span>
            <input
              type="number"
              min="1"
              step="1"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className={css.priceInput}
              placeholder="Например, 250"
              required
            />
          </div>
        </div>

        <div className={css.inputGroup}>
          <label className={css.label}>
            Комментарий
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className={css.commentTextarea}
            rows={4}
            placeholder="Кратко опишите: сроки выполнения, условия, что входит в работу..."
          />
        </div>

        {err && <div className={css.errorMessage}>{err}</div>}
        {ok && <div className={css.successMessage}>Отклик отправлен!</div>}

        <button 
          type="submit" 
          disabled={submitting} 
          className={css.submitButton}
        >
          {submitting ? 'Отправка…' : 'Отправить отклик'}
        </button>
      </form>
    </div>
  );
}

OfferForm.propTypes = {
  listingId: PropTypes.string.isRequired,
  processAlias: PropTypes.string,
  listingStatus: PropTypes.string,
  assignedTo: PropTypes.string,
  currentUserId: PropTypes.string,
  currentUser: PropTypes.object,
  isOnlyCustomer: PropTypes.bool,
  category: PropTypes.string,
  city: PropTypes.string,
};