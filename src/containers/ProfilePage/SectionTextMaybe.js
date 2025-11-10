import React from 'react';
import { Heading } from '../../components';
import { richText } from '../../util/richText';
import { useIntl } from '../../util/reactIntl';

import css from './ProfilePage.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 20;

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

  const translatedHeading =
    heading && typeof heading === 'string' && heading.includes('.')
      ? intl.formatMessage({ id: heading, defaultMessage: heading })
      : heading;

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
