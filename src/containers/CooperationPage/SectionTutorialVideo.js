import React from 'react';

import { useIntl } from '../../util/reactIntl';
import { youtubeEmbedUrl, youtubeVideoId } from '../../util/youtube';

import css from './SectionTutorialVideo.module.css';

/**
 * Обучающий ролик YouTube для специалистов.
 *
 * @param {Object} props
 * @param {string} props.videoUrl любая ссылка на ролик; без неё блок не рисуется
 */
const SectionTutorialVideo = props => {
  const { videoUrl } = props;
  const intl = useIntl();
  const videoId = youtubeVideoId(videoUrl);

  if (!videoId) {
    return null;
  }

  const title = intl.formatMessage({ id: 'CooperationPage.videoTitle' });

  return (
    <section className={css.root}>
      <h2 className={css.title}>{title}</h2>
      <p className={css.subtitle}>{intl.formatMessage({ id: 'CooperationPage.videoSubtitle' })}</p>

      <div className={css.player}>
        <iframe
          className={css.frame}
          src={youtubeEmbedUrl(videoId)}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </section>
  );
};

export default SectionTutorialVideo;
