import React from 'react';
import classNames from 'classnames';

import { useIntl } from '../../util/reactIntl';
import { NamedLink, ReviewRating } from '../../components';

import css from './SectionTaskOfTheMonth.module.css';

// Середина месяца остаётся тем же месяцем в любом часовом поясе
const monthDate = monthKey => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 15));
};

const initials = name =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');

/**
 * Самое крупное задание прошлого месяца, его исполнитель и отзыв заказчика.
 *
 * @param {Object} props
 * @param {string} props.month 'YYYY-MM'
 * @param {Object} props.task ответ /api/task-of-the-month; без него блок не рисуется
 */
const SectionTaskOfTheMonth = props => {
  const { month, task } = props;
  const intl = useIntl();

  if (!month || !task) {
    return null;
  }

  const { title, amountAED, specialist, review } = task;
  const monthLabel = intl.formatDate(monthDate(month), {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });

  return (
    <section className={css.root}>
      <h2 className={css.title}>
        {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthTitle' })}
      </h2>
      <p className={css.subtitle}>
        {intl.formatMessage(
          { id: 'CooperationPage.taskOfTheMonthSubtitle' },
          { month: monthLabel }
        )}
      </p>

      <div className={classNames(css.card, { [css.cardWithReview]: !!review })}>
        <div className={css.main}>
          <p className={css.label}>
            {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthTaskLabel' })}
          </p>
          <h3 className={css.taskTitle}>{title}</h3>

          <div className={css.amountRow}>
            <span className={css.amount}>
              {intl.formatNumber(amountAED, { maximumFractionDigits: 2 })} AED
            </span>
            <span className={css.amountLabel}>
              {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthAmountLabel' })}
            </span>
          </div>

          <NamedLink name="ProfilePage" params={{ id: specialist.id }} className={css.specialist}>
            {specialist.avatarUrl ? (
              <img className={css.avatar} src={specialist.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className={css.avatar} aria-hidden="true">
                {initials(specialist.displayName)}
              </span>
            )}
            <span className={css.specialistText}>
              <span className={css.label}>
                {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthSpecialistLabel' })}
              </span>
              <span className={css.specialistName}>{specialist.displayName}</span>
              <span className={css.profileLink}>
                {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthProfileLink' })}
              </span>
            </span>
          </NamedLink>
        </div>

        {review ? (
          <figure className={css.review}>
            <p className={css.label}>
              {intl.formatMessage({ id: 'CooperationPage.taskOfTheMonthReviewLabel' })}
            </p>
            {review.rating ? (
              <ReviewRating
                rating={review.rating}
                className={css.stars}
                reviewStarClassName={css.star}
              />
            ) : null}
            {review.content ? (
              <blockquote className={css.reviewText}>{review.content}</blockquote>
            ) : null}
            {review.authorName ? (
              <figcaption className={css.reviewAuthor}>
                {intl.formatMessage(
                  { id: 'CooperationPage.taskOfTheMonthReviewAuthor' },
                  { name: review.authorName }
                )}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>
    </section>
  );
};

export default SectionTaskOfTheMonth;
