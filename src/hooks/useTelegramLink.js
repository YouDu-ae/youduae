import { useCallback, useEffect, useState } from 'react';

import { generateTelegramCode, getTelegramStatus } from '../util/api';

/**
 * Shared logic for every "connect Telegram" entry point.
 *
 * Linking used to send people to the bare bot link, where the bot could only
 * tell them to go back to the site for a code. This hook instead requests a
 * code and opens the deep link, so the bot binds the account on /start.
 *
 * The popup is opened synchronously inside the click handler because browsers
 * block window.open once the call stack leaves the user gesture.
 */
export const useTelegramLink = ({ currentUser, skipStatusCheck = false } = {}) => {
  const [isLinked, setIsLinked] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const userId = currentUser?.id?.uuid;
  // Own privateData comes with currentUser, so the common case needs no
  // request at all. Falling back to the endpoint keeps callers working when
  // the profile was fetched without it.
  const privateData = currentUser?.attributes?.profile?.privateData;
  const linkedFromProfile = privateData ? !!privateData.telegramChatId : null;

  useEffect(() => {
    if (!userId || skipStatusCheck) {
      return;
    }

    if (linkedFromProfile !== null) {
      setIsLinked(linkedFromProfile);
      return;
    }

    let cancelled = false;

    getTelegramStatus()
      .then(data => {
        if (!cancelled) {
          setIsLinked(!!data.isLinked);
        }
      })
      .catch(() => {
        // Treat an unknown status as "not linked" so the prompt still shows.
        if (!cancelled) {
          setIsLinked(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, skipStatusCheck, linkedFromProfile]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);

    const popup = typeof window !== 'undefined' ? window.open('', '_blank') : null;

    try {
      const { deepLink } = await generateTelegramCode();

      if (!deepLink) {
        throw new Error('Deep link missing');
      }

      if (popup) {
        popup.location.href = deepLink;
      } else {
        window.location.href = deepLink;
      }
    } catch (e) {
      if (popup) {
        popup.close();
      }
      setError('Не удалось создать ссылку. Попробуйте ещё раз.');
    } finally {
      setConnecting(false);
    }
  }, []);

  const refreshStatus = useCallback(() => {
    return getTelegramStatus()
      .then(data => {
        setIsLinked(!!data.isLinked);
        return !!data.isLinked;
      })
      .catch(() => false);
  }, []);

  return { isLinked, connecting, error, connect, refreshStatus };
};

export default useTelegramLink;
