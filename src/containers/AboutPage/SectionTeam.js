import React from 'react';
import classNames from 'classnames';
import { Helmet } from 'react-helmet-async';

import SectionContainer from '../PageBuilder/SectionBuilder/SectionContainer';

import css from './AboutPage.module.css';

/**
 * Custom PageBuilder section: team members with photo, name, role, bio, LinkedIn.
 */
const SectionTeam = props => {
  const {
    sectionId,
    className,
    rootClassName,
    defaultClasses,
    title,
    description,
    members = [],
    appearance,
  } = props;

  const classes = classNames(rootClassName || css.teamSection, className);
  const titleText = typeof title === 'string' ? title : title?.content;
  const descriptionText = typeof description === 'string' ? description : description?.content;

  const personSchema = {
    '@context': 'https://schema.org',
    '@graph': members.map(member => ({
      '@type': 'Person',
      name: member.name,
      jobTitle: member.role,
      description: member.bio,
      image: member.photoAbsolute || member.photo,
      worksFor: {
        '@type': 'Organization',
        name: 'YouDu',
        url: 'https://youdu.ae',
      },
      ...(member.linkedin ? { sameAs: [member.linkedin] } : {}),
    })),
  };

  return (
    <SectionContainer id={sectionId} className={classes} appearance={appearance}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(personSchema)}</script>
      </Helmet>

      <div className={css.teamIntro}>
        {titleText ? (
          <h2 className={classNames(defaultClasses?.title, css.teamTitle)}>{titleText}</h2>
        ) : null}
        {descriptionText ? <p className={css.teamLead}>{descriptionText}</p> : null}
      </div>

      <div className={css.grid}>
        {members.map(member => (
          <article key={member.id} className={css.member}>
            <div className={css.photoWrap}>
              <img
                className={css.photo}
                src={member.photo}
                alt={member.photoAlt}
                width={800}
                height={800}
                loading="lazy"
              />
            </div>
            <div className={css.body}>
              <h3 className={css.name}>{member.name}</h3>
              <p className={css.role}>{member.role}</p>
              <p className={css.bio}>{member.bio}</p>
              {member.linkedin ? (
                <a
                  className={css.linkedin}
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
};

export default SectionTeam;
