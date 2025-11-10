import React from 'react';
import { Heading, IconSocialMediaInstagram } from '../../components';
import { richText } from '../../util/richText';
import { useIntl } from '../../util/reactIntl';

import css from './ProfilePage.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 20;
const INSTAGRAM_BASE_URL = 'https://www.instagram.com/';

const sanitizeInstagramHandle = value => {
  if (value == null) {
    return null;
  }

  let handle = `${value}`.trim();
  if (!handle) {
    return null;
  }

  handle = handle.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  handle = handle.replace(/\?.*$/, '');
  handle = handle.replace(/\/+$/, '');
  handle = handle.replace(/^@/, '');

  return handle || null;
};

const ensureUrlProtocol = value =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

const SectionTextMaybe = props => {
  const intl = useIntl();
  const { text, heading, showAsIngress = false } = props;
  const textClass = showAsIngress ? css.ingress : css.text;
  const content = richText(text, {
    linkify: true,
    longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
    longWordClass: css.longWord,
    breakChars: '/',
  });

  const rawHeading = heading;
  const translatedHeading =
    heading && typeof heading === 'string' && heading.includes('.')
      ? intl.formatMessage({ id: heading, defaultMessage: heading })
      : heading;

  const isInstagramField = rawHeading === 'ProfileSettingsForm.socialInstagram';
  const isWebsiteField = rawHeading === 'ProfileSettingsForm.socialWebsite';

  if ((isInstagramField || isWebsiteField) && text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    let normalizedUrl = trimmed;
    let displayValue = trimmed.replace(/^https?:\/\//i, '');
    let icon = (
      <span className={css.socialWebsiteIcon} aria-hidden="true">
        🌐
      </span>
    );

    if (isInstagramField) {
      const handle = sanitizeInstagramHandle(trimmed);
      if (!handle) return null;

      normalizedUrl = `${INSTAGRAM_BASE_URL}${handle}`;
      displayValue = `@${handle}`;
      icon = <IconSocialMediaInstagram className={css.socialIcon} />;
    } else {
      normalizedUrl = ensureUrlProtocol(trimmed);
      displayValue = normalizedUrl.replace(/^https?:\/\//i, '');
    }

    return (
      <div className={css.sectionText}>
        {translatedHeading ? (
          <Heading as="h2" rootClassName={css.sectionHeading}>
            {translatedHeading}
          </Heading>
        ) : null}
        <a
          className={css.socialBadge}
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {icon}
          <span className={css.socialText}>{displayValue}</span>
        </a>
      </div>
    );
  }

  return text ? (
    <div className={css.sectionText}>
      {translatedHeading ? (
        <Heading as="h2" rootClassName={css.sectionHeading}>
          {translatedHeading}
        </Heading>
      ) : null}
      <p className={textClass}>{content}</p>
    </div>
  ) : null;
};

export default SectionTextMaybe;
