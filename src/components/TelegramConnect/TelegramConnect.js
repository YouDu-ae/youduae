import React, { useState, useEffect } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { IconSpinner, Button, ExternalLink } from '../../components';
import {
  generateTelegramCode,
  getTelegramStatus,
  unlinkTelegram as unlinkTelegramRequest,
} from '../../util/api';

import css from './TelegramConnect.module.css';

const TELEGRAM_BOT_USERNAME = 'YouDuAE_bot';

const TelegramConnect = props => {
  const { currentUser, className } = props;
  const intl = useIntl();
  
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
      const data = await getTelegramStatus();
      
      setIsLinked(data.isLinked);
      setLinkedAt(data.linkedAt);
      setError(null);
    } catch (err) {
      console.error('Error checking Telegram status:', err);
      setError('TelegramConnect.statusError');
    } finally {
      setLoading(false);
    }
  };
  
  const generateCode = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const data = await generateTelegramCode();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setVerificationCode(data.code);
      setDeepLink(data.deepLink);
    } catch (err) {
      console.error('Error generating code:', err);
      setError('TelegramConnect.generateCodeError');
    } finally {
      setGenerating(false);
    }
  };
  
  const unlinkTelegram = async () => {
    if (!window.confirm(intl.formatMessage({ id: 'TelegramConnect.unlinkConfirm' }))) {
      return;
    }
    
    try {
      setUnlinking(true);
      setError(null);
      
      const data = await unlinkTelegramRequest();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setIsLinked(false);
      setLinkedAt(null);
      setVerificationCode(null);
      setDeepLink(null);
    } catch (err) {
      console.error('Error unlinking Telegram:', err);
      setError('TelegramConnect.unlinkError');
    } finally {
      setUnlinking(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return intl.formatDate(date, {
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
          <FormattedMessage id="TelegramConnect.title" />
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
        <FormattedMessage id="TelegramConnect.title" />
      </h3>
      
      <p className={css.description}>
        <FormattedMessage id="TelegramConnect.description" />
      </p>
      
      {error && (
        <div className={css.error}>
          <FormattedMessage id={error} />
        </div>
      )}
      
      {isLinked ? (
        <div className={css.linkedSection}>
          <div className={css.statusConnected}>
            <span className={css.statusIcon}>✅</span>
            <div className={css.statusText}>
              <strong>
                <FormattedMessage id="TelegramConnect.connected" />
              </strong>
              {linkedAt && (
                <span className={css.linkedDate}>
                  <FormattedMessage
                    id="TelegramConnect.linkedSince"
                    values={{ date: formatDate(linkedAt) }}
                  />
                </span>
              )}
            </div>
          </div>
          
          <p className={css.linkedInfo}>
            <FormattedMessage id="TelegramConnect.notificationsIntro" />
          </p>
          <ul className={css.featureList}>
            <li>
              📬 <FormattedMessage id="TelegramConnect.featureNewOffers" />
            </li>
            <li>
              ✅ <FormattedMessage id="TelegramConnect.featureSelected" />
            </li>
            <li>
              💬 <FormattedMessage id="TelegramConnect.featureNewMessages" />
            </li>
          </ul>
          
          <Button
            className={css.unlinkButton}
            onClick={unlinkTelegram}
            inProgress={unlinking}
          >
            <FormattedMessage id="TelegramConnect.unlinkButton" />
          </Button>
        </div>
      ) : (
        <div className={css.connectSection}>
          {verificationCode ? (
            <div className={css.codeSection}>
              <p className={css.codeInstructions}>
                <FormattedMessage
                  id="TelegramConnect.step1"
                  values={{ strong: chunks => <strong>{chunks}</strong> }}
                />
              </p>
              
              <ExternalLink
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                className={css.botLink}
              >
                @{TELEGRAM_BOT_USERNAME}
              </ExternalLink>
              
              <p className={css.codeInstructions}>
                <FormattedMessage
                  id="TelegramConnect.step2"
                  values={{ strong: chunks => <strong>{chunks}</strong> }}
                />
              </p>
              
              <div className={css.codeDisplay}>
                {verificationCode}
              </div>
              
              <p className={css.codeExpiry}>
                <FormattedMessage id="TelegramConnect.codeExpiry" values={{ minutes: 10 }} />
              </p>
              
              <div className={css.orDivider}>
                <span>
                  <FormattedMessage id="TelegramConnect.or" />
                </span>
              </div>
              
              <ExternalLink
                href={deepLink}
                className={css.deepLinkButton}
              >
                <FormattedMessage id="TelegramConnect.openBotAutomatically" />
              </ExternalLink>
              
              <Button
                className={css.refreshButton}
                onClick={checkStatus}
              >
                <FormattedMessage id="TelegramConnect.checkCode" />
              </Button>
            </div>
          ) : (
            <div className={css.generateSection}>
              <div className={css.statusDisconnected}>
                <span className={css.statusIcon}>🔕</span>
                <span>
                  <FormattedMessage id="TelegramConnect.notConnected" />
                </span>
              </div>
              
              <Button
                className={css.connectButton}
                onClick={generateCode}
                inProgress={generating}
              >
                <FormattedMessage id="TelegramConnect.connectButton" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramConnect;
