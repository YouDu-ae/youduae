import React, { useState, useEffect } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../util/reactIntl';
import { IconSpinner, Button, ExternalLink } from '../../components';

import css from './TelegramConnect.module.css';

const TELEGRAM_BOT_USERNAME = 'YouDuAE_bot';

const TelegramConnect = props => {
  const { currentUser, className } = props;
  
  const [isLinked, setIsLinked] = useState(false);
  const [linkedAt, setLinkedAt] = useState(null);
  const [verificationCode, setVerificationCode] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState(null);
  
  const userId = currentUser?.id?.uuid;
  
  // Check Telegram status on mount
  useEffect(() => {
    if (!userId) return;
    
    checkStatus();
  }, [userId]);
  
  const checkStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/telegram/status?userId=${userId}`);
      const data = await response.json();
      
      setIsLinked(data.isLinked);
      setLinkedAt(data.linkedAt);
      setError(null);
    } catch (err) {
      console.error('Error checking Telegram status:', err);
      setError('Ошибка проверки статуса');
    } finally {
      setLoading(false);
    }
  };
  
  const generateCode = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await fetch('/api/telegram/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setVerificationCode(data.code);
      setDeepLink(data.deepLink);
    } catch (err) {
      console.error('Error generating code:', err);
      setError('Ошибка генерации кода');
    } finally {
      setGenerating(false);
    }
  };
  
  const unlinkTelegram = async () => {
    if (!window.confirm('Вы уверены, что хотите отключить Telegram уведомления?')) {
      return;
    }
    
    try {
      setUnlinking(true);
      setError(null);
      
      const response = await fetch('/api/telegram/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setIsLinked(false);
      setLinkedAt(null);
      setVerificationCode(null);
      setDeepLink(null);
    } catch (err) {
      console.error('Error unlinking Telegram:', err);
      setError('Ошибка отключения');
    } finally {
      setUnlinking(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };
  
  const classes = classNames(css.root, className);
  
  if (loading) {
    return (
      <div className={classes}>
        <h3 className={css.title}>
          <span className={css.telegramIcon}>📱</span>
          Telegram уведомления
        </h3>
        <div className={css.loadingWrapper}>
          <IconSpinner />
        </div>
      </div>
    );
  }
  
  return (
    <div className={classes}>
      <h3 className={css.title}>
        <span className={css.telegramIcon}>📱</span>
        Telegram уведомления
      </h3>
      
      <p className={css.description}>
        Получайте мгновенные уведомления о новых откликах, сообщениях и заданиях прямо в Telegram.
      </p>
      
      {error && (
        <div className={css.error}>
          {error}
        </div>
      )}
      
      {isLinked ? (
        <div className={css.linkedSection}>
          <div className={css.statusConnected}>
            <span className={css.statusIcon}>✅</span>
            <div className={css.statusText}>
              <strong>Telegram подключён</strong>
              {linkedAt && (
                <span className={css.linkedDate}>
                  с {formatDate(linkedAt)}
                </span>
              )}
            </div>
          </div>
          
          <p className={css.linkedInfo}>
            Вы будете получать уведомления о:
          </p>
          <ul className={css.featureList}>
            <li>📬 Новых откликах на ваши задания</li>
            <li>✅ Когда вас выбрали исполнителем</li>
            <li>💬 Новых сообщениях в чатах</li>
          </ul>
          
          <Button
            className={css.unlinkButton}
            onClick={unlinkTelegram}
            inProgress={unlinking}
          >
            Отключить Telegram
          </Button>
        </div>
      ) : (
        <div className={css.connectSection}>
          {verificationCode ? (
            <div className={css.codeSection}>
              <p className={css.codeInstructions}>
                <strong>Шаг 1:</strong> Откройте бота в Telegram
              </p>
              
              <ExternalLink
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                className={css.botLink}
              >
                @{TELEGRAM_BOT_USERNAME}
              </ExternalLink>
              
              <p className={css.codeInstructions}>
                <strong>Шаг 2:</strong> Отправьте боту этот код:
              </p>
              
              <div className={css.codeDisplay}>
                {verificationCode}
              </div>
              
              <p className={css.codeExpiry}>
                Код действителен 10 минут
              </p>
              
              <div className={css.orDivider}>
                <span>или</span>
              </div>
              
              <ExternalLink
                href={deepLink}
                className={css.deepLinkButton}
              >
                Открыть бота и подключить автоматически
              </ExternalLink>
              
              <Button
                className={css.refreshButton}
                onClick={checkStatus}
              >
                Я отправил код — проверить
              </Button>
            </div>
          ) : (
            <div className={css.generateSection}>
              <div className={css.statusDisconnected}>
                <span className={css.statusIcon}>🔕</span>
                <span>Telegram не подключён</span>
              </div>
              
              <Button
                className={css.connectButton}
                onClick={generateCode}
                inProgress={generating}
              >
                Подключить Telegram
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramConnect;
