import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { ASSIGNMENT_PROCESS_NAME } from '../../../transactions/transaction';
import { fetchTaskChatSummary } from '../../../util/api';
import { listingWorkStatus } from '../../../util/listingWorkStatus';
import { NamedLink, VerificationBadge } from '../../../components';
import StarRating from '../../../components/StarRating/StarRating';

import css from './TransactionPanel.module.css';

export const listingTaskStatus = listing => {
  const publicData = listing?.attributes?.publicData || {};
  const workStatus = listingWorkStatus(publicData);
  if (workStatus === 'cancelled' || workStatus === 'completed') {
    return workStatus;
  }
  // Hiring closes the listing in Sharetribe, so the hired flags have to win
  // over the closed state, otherwise a task in progress reads as finished.
  if (workStatus === 'in-progress') {
    return 'inProgress';
  }
  if (publicData.status === 'closed' || listing?.attributes?.state === 'closed') {
    return 'closed';
  }
  return 'open';
};

const FINISHED_STATES = ['completed', 'reviewed-by-customer', 'reviewed-by-provider', 'reviewed'];

/**
 * What this conversation is about right now. The listing state alone cannot
 * tell "work in progress" from "task finished" (the listing is closed as soon
 * as anyone is hired), so this specialist's own deal is read first and the
 * task's publicData fills in the rest.
 */
export const chatTaskStatus = (processState, listing) => {
  if (FINISHED_STATES.includes(processState)) {
    return 'completed';
  }
  if (processState === 'declined') {
    return 'declined';
  }
  const taskStatus = listingTaskStatus(listing);
  // A finished or cancelled task is over for every specialist in it, including
  // one whose accepted deal was left behind by «Сменить исполнителя».
  if (taskStatus === 'completed' || taskStatus === 'cancelled') {
    return taskStatus;
  }
  if (processState === 'accepted') {
    return 'hired';
  }
  return taskStatus;
};

const formatOfferPrice = offer => {
  if (!offer || offer.price === undefined || offer.price === null || offer.price === '') {
    return null;
  }
  const amount = Number(offer.price);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const currency = offer.currency || 'AED';
  return `${amount} ${currency}`;
};

/**
 * Brief task facts in the chat: this offer's price, listing status, and how
 * many other specialists still have a pending offer. Shown to both parties.
 */
const TaskSummaryMaybe = props => {
  const { processName, processState, transactionId, listing, offer, isTaskAuthor } = props;
  const [summary, setSummary] = useState(null);

  const txId = transactionId?.uuid || transactionId;
  const isAssignment = processName === ASSIGNMENT_PROCESS_NAME;

  useEffect(() => {
    if (!isAssignment || !txId) {
      return undefined;
    }

    let cancelled = false;
    fetchTaskChatSummary(txId)
      .then(data => {
        if (!cancelled && typeof data?.otherOfferCount === 'number') {
          setSummary(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAssignment, txId]);

  if (!isAssignment) {
    return null;
  }

  const priceLabel = formatOfferPrice(offer);
  const status = chatTaskStatus(processState, listing);
  const otherOfferCount = summary?.otherOfferCount;
  const otherOffers = isTaskAuthor && Array.isArray(summary?.otherOffers) ? summary.otherOffers : null;

  return (
    <div className={css.taskSummary}>
      {priceLabel ? (
        <div className={css.taskSummaryRow}>
          <span className={css.taskSummaryLabel}>
            <FormattedMessage id="TransactionPanel.taskSummary.price" />
          </span>
          <span className={css.taskSummaryValue}>{priceLabel}</span>
        </div>
      ) : null}
      <div className={css.taskSummaryRow}>
        <span className={css.taskSummaryLabel}>
          <FormattedMessage id="TransactionPanel.taskSummary.status" />
        </span>
        <span
          className={classNames(css.taskSummaryValue, {
            [css.taskSummaryValueHighlight]: status === 'hired',
          })}
        >
          <FormattedMessage id={`TransactionPanel.taskSummary.status.${status}`} />
        </span>
      </div>
      {otherOfferCount === null || otherOfferCount === undefined || status !== 'open' ? null : (
        <div className={css.taskSummaryNote}>
          <FormattedMessage
            id="TransactionPanel.taskSummary.otherOffers"
            values={{ count: otherOfferCount }}
          />
          {otherOffers && otherOffers.length > 0 ? (
            <ul className={css.otherOfferList}>
              {otherOffers.map(item => (
                <li key={item.transactionId} className={css.otherOfferItem}>
                  <div className={css.otherOfferHead}>
                    <NamedLink
                      className={css.otherOfferLink}
                      name="SaleDetailsPage"
                      params={{ id: item.transactionId }}
                    >
                      {item.name || '—'} — {Number.isFinite(item.price) ? item.price : '—'}{' '}
                      {item.currency || 'AED'}
                    </NamedLink>
                    {item.verified ? <VerificationBadge isVerified /> : null}
                  </div>
                  <div className={css.otherOfferMeta}>
                    {item.rating > 0 ? (
                      <>
                        <StarRating rating={item.rating} />
                        <FormattedMessage
                          id="TransactionPanel.taskSummary.otherOfferReviews"
                          values={{ rating: Number(item.rating).toFixed(1), count: item.reviewCount }}
                        />
                      </>
                    ) : (
                      <FormattedMessage id="TransactionPanel.taskSummary.otherOfferNoReviews" />
                    )}
                    <span className={css.otherOfferDot} aria-hidden="true">
                      ·
                    </span>
                    <FormattedMessage
                      id="TransactionPanel.taskSummary.otherOfferCompleted"
                      values={{ count: item.completedCount || 0 }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TaskSummaryMaybe;
