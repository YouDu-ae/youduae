import React, { useState, useEffect } from 'react';
import { ExternalLink } from '../../components';
import css from './TelegramBanner.module.css';

const TELEGRAM_BOT_URL = 'https://t.me/YouDuAE_bot';
const TELEGRAM_GROUP_URL = 'https://t.me/+FxO8HMVQMz1kNGVi';
const STORAGE_KEY = 'telegramBannerDismissed';
const DISMISS_DAYS = 7; // Show again after 7 days

const TelegramBanner = ({ userType }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt, 10));
      const now = new Date();
      const daysSinceDismissed = (now - dismissedDate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDismissed < DISMISS_DAYS) {
        return; // Still within dismiss period
      }
    }
    
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
  };

  if (!isVisible) return null;

  // Different messages for Provider (заказчик) and Customer (исполнитель)
  const isProvider = userType === 'provider';
  
  return (
    <div className={css.banner}>
      <div className={css.content}>
        <div className={css.iconWrapper}>
          <svg viewBox="0 0 48 48" fill="none" className={css.telegramIcon}>
            <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#fff"/>
            <path d="M34.143 15.176L30.1 33.667c-.305 1.342-1.1 1.675-2.231 1.043l-6.16-4.54-2.97 2.86c-.329.33-.604.604-1.237.604l.441-6.274 11.402-10.305c.496-.44-.108-.686-.77-.247L14.42 25.714l-6.08-1.9c-1.321-.414-1.346-1.321.275-1.956l23.768-9.16c1.1-.414 2.063.247 1.76 2.478z" fill="#0088cc"/>
          </svg>
        </div>
        
        <div className={css.textContent}>
          <h3 className={css.title}>
            {isProvider 
              ? 'Не пропустите отклики специалистов!' 
              : 'Не пропустите новые задания!'}
          </h3>
          <p className={css.description}>
            {isProvider
              ? 'Подключите Telegram-бот и получайте уведомления о новых откликах мгновенно.'
              : 'Подключите Telegram-бот и узнавайте о новых заданиях первым.'}
          </p>
          
          <div className={css.links}>
            <ExternalLink href={TELEGRAM_BOT_URL} className={css.primaryLink}>
              Подключить бота
            </ExternalLink>
            <ExternalLink href={TELEGRAM_GROUP_URL} className={css.secondaryLink}>
              Новости YouDu
            </ExternalLink>
          </div>
        </div>
        
        <button 
          type="button" 
          className={css.closeButton} 
          onClick={handleDismiss}
          aria-label="Закрыть"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={css.closeIcon}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TelegramBanner;
