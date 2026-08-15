import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../util/reactIntl';
import { ExternalLink, Menu, MenuContent, MenuItem, MenuLabel } from '../../components';

import { IconCheck, IconLink, IconMore, IconSend, IconTelegram, IconWhatsApp } from './ShareIcons';
import css from './ShareButton.module.css';

const COPIED_FEEDBACK_MS = 1600;

/**
 * Tags the shared link so Plausible can attribute visits that came from users
 * passing links around. Falls back to the plain URL if it can't be parsed.
 */
const withUtm = (url, medium) => {
  try {
    const tagged = new URL(url);
    tagged.searchParams.set('utm_source', 'share');
    tagged.searchParams.set('utm_medium', medium);
    return tagged.toString();
  } catch (e) {
    return url;
  }
};

/**
 * The Clipboard API needs a secure context, so keep the textarea fallback for
 * browsers and embedded webviews where it isn't available.
 */
const copyToClipboard = async text => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fall through to the legacy approach below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch (e) {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

/**
 * Share button that opens a small popover with the channels people actually use
 * to pass links around: Telegram, WhatsApp, a copyable link, and the device's
 * own share sheet where the browser supports it.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string} props.url absolute URL that gets shared
 * @param {string?} props.title used as the title of the device's native share sheet
 * @param {string?} props.text message that precedes the link in messengers
 * @returns {JSX.Element} share button with a popover
 */
const ShareButton = props => {
  const { className, rootClassName, url, title, text } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const timeoutRef = useRef(null);

  // Resolved after mount so that server-rendered and hydrated markup match.
  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (!url) {
    return null;
  }

  const shareText = text || title || '';
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    withUtm(url, 'telegram')
  )}&text=${encodeURIComponent(shareText)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${shareText} ${withUtm(url, 'whatsapp')}`.trim()
  )}`;

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(withUtm(url, 'copy_link'));
    if (!didCopy) {
      return;
    }

    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, COPIED_FEEDBACK_MS);
  };

  const handleNativeShare = () => {
    setIsOpen(false);
    // A rejected promise just means the user dismissed the sheet.
    navigator.share({ title, text: shareText, url: withUtm(url, 'native') }).catch(() => {});
  };

  const classes = classNames(rootClassName || css.root, className);

  return (
    <Menu
      className={classes}
      isOpen={isOpen}
      onToggleActive={setIsOpen}
      preferScreenWidthOnMobile
      contentPlacementOffset={0}
    >
      <MenuLabel rootClassName={css.label} isOpenClassName={css.labelOpen}>
        <IconSend className={css.labelIcon} />
        <span className={css.labelText}>
          <FormattedMessage id="ShareButton.label" />
        </span>
      </MenuLabel>

      <MenuContent className={css.content} contentClassName={css.list}>
        <MenuItem key="telegram">
          <ExternalLink href={telegramUrl} className={css.item} onClick={() => setIsOpen(false)}>
            <IconTelegram className={classNames(css.itemIcon, css.telegram)} />
            <FormattedMessage id="ShareButton.telegram" />
          </ExternalLink>
        </MenuItem>

        <MenuItem key="whatsapp">
          <ExternalLink href={whatsappUrl} className={css.item} onClick={() => setIsOpen(false)}>
            <IconWhatsApp className={classNames(css.itemIcon, css.whatsapp)} />
            <FormattedMessage id="ShareButton.whatsapp" />
          </ExternalLink>
        </MenuItem>

        <MenuItem key="copy">
          <button type="button" className={css.item} onClick={handleCopy}>
            {copied ? (
              <>
                <IconCheck className={classNames(css.itemIcon, css.strokeIcon, css.copied)} />
                <FormattedMessage id="ShareButton.copied" />
              </>
            ) : (
              <>
                <IconLink className={classNames(css.itemIcon, css.strokeIcon)} />
                <FormattedMessage id="ShareButton.copyLink" />
              </>
            )}
          </button>
        </MenuItem>

        {hasNativeShare ? (
          <MenuItem key="native">
            <button type="button" className={css.item} onClick={handleNativeShare}>
              <IconMore className={css.itemIcon} />
              <FormattedMessage id="ShareButton.nativeShare" />
            </button>
          </MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  );
};

export default ShareButton;
