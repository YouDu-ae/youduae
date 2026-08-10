import React from 'react';
import classNames from 'classnames';

import { useTelegramLink } from '../../hooks/useTelegramLink';

import css from './TelegramConnectPrompt.module.css';

/**
 * Compact one-click Telegram prompt for contextual placements, such as right
 * after an offer is sent. Renders nothing for users who already linked.
 */
const TelegramConnectPrompt = props => {
  const { currentUser, title, description, className } = props;
  const { isLinked, connecting, error, connect } = useTelegramLink({ currentUser });

  if (isLinked !== false) {
    return null;
  }

  return (
    <div className={classNames(css.root, className)}>
      <span className={css.icon} aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#0088cc" />
          <path
            d="M34.143 15.176L30.1 33.667c-.305 1.342-1.1 1.675-2.231 1.043l-6.16-4.54-2.97 2.86c-.329.33-.604.604-1.237.604l.441-6.274 11.402-10.305c.496-.44-.108-.686-.77-.247L14.42 25.714l-6.08-1.9c-1.321-.414-1.346-1.321.275-1.956l23.768-9.16c1.1-.414 2.063.247 1.76 2.478z"
            fill="#fff"
          />
        </svg>
      </span>

      <div className={css.body}>
        <strong className={css.title}>{title}</strong>
        <p className={css.description}>{description}</p>
        {error ? <p className={css.error}>{error}</p> : null}
      </div>

      <button type="button" onClick={connect} disabled={connecting} className={css.button}>
        {connecting ? 'Открываем…' : 'Подключить'}
      </button>
    </div>
  );
};

export default TelegramConnectPrompt;
