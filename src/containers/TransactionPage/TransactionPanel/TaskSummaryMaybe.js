import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { ASSIGNMENT_PROCESS_NAME } from '../../../transactions/transaction';
import { fetchTaskChatSummary } from '../../../util/api';

import css from './TransactionPanel.module.css';

export const listingTaskStatus = listing => {
  const publicData = listing?.attributes?.publicData || {};
  if (publicData.cancelled === true || publicData.status === 'cancelled') {
    return 'cancelled';
  }
  // Hiring closes the listing in Sharetribe, so the hired flags have to win
  // over the closed state, otherwise a task in progress reads as finished.
  if (publicData.hired === true || publicData.status === 'in-progress') {
    return 'inProgress';
  }
  if (publicData.status === 'closed' || listing?.attributes?.state === 'closed') {
    return 'closed';
  }
  return 'open';
};

const FINISHED_STATES = ['completed', 'reviewed-by-customer', 'reviewed-by-provider', 'reviewed'];

/**
 * What this conversation is about right now. The transaction knows more than
 * the listing here: the listing is closed as soon as anyone is hired, so it
 * cannot tell "work in progress" from "task finished".
 */
export const chatTaskStatus = (processState, listing) => {
  if (FINISHED_STATES.includes(processState)) {
    return 'completed';
  }
  if (processState === 'accepted') {
    return 'hired';
  }
  if (processState === 'declined') {
    return 'declined';
  }
  return listingTaskStatus(listing);
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
  const { processName, processState, transactionId, listing, offer } = props;
  const [otherOfferCount, setOtherOfferCount] = useState(null);

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
          setOtherOfferCount(data.otherOfferCount);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOtherOfferCount(null);
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
      {otherOfferCount === null || status !== 'open' ? null : (
        <div className={css.taskSummaryNote}>
          <FormattedMessage
            id="TransactionPanel.taskSummary.otherOffers"
            values={{ count: otherOfferCount }}
          />
        </div>
      )}
    </div>
  );
};

export default TaskSummaryMaybe;
