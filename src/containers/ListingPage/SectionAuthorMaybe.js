import React, { useState, useEffect } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { INQUIRY_PROCESS_NAME, resolveLatestProcessName } from '../../transactions/transaction';

import { Heading, Modal, StarRating } from '../../components';
import UserCard from './UserCard/UserCard';
import InquiryForm from './InquiryForm/InquiryForm';
import { getUserReviewsStats } from '../../util/api';

import css from './ListingPage.module.css';

const SectionAuthorMaybe = props => {
  const {
    title,
    listing,
    authorDisplayName,
    onContactUser,
    isInquiryModalOpen,
    onCloseInquiryModal,
    sendInquiryError,
    sendInquiryInProgress,
    onSubmitInquiry,
    currentUser,
    onManageDisableScrolling,
  } = props;

  const [providerStats, setProviderStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Загружаем статистику отзывов для Provider'а
  useEffect(() => {
    if (listing.author?.id?.uuid) {
      setLoadingStats(true);
      getUserReviewsStats(listing.author.id.uuid, 'client')
        .then(response => {
          // API returns { status, statusText, data: { userId, reviewCount, averageRating } }
          const stats = response.data || response;
          setProviderStats(stats);
          setLoadingStats(false);
        })
        .catch(err => {
          console.error('Failed to load provider stats:', err);
          setLoadingStats(false);
        });
    }
  }, [listing.author?.id?.uuid]);

  if (!listing.author) {
    return null;
  }

  const transactionProcessAlias = listing?.attributes?.publicData?.transactionProcessAlias || '';
  const processName = resolveLatestProcessName(transactionProcessAlias.split('/')[0]);
  const isInquiryProcess = processName === INQUIRY_PROCESS_NAME;

  const rating = providerStats?.averageRating ? parseFloat(providerStats.averageRating) : 0;
  const reviewCount = providerStats?.reviewCount || 0;

  // Функция для правильного склонения слова "отзыв"
  const getReviewWord = count => {
    if (count % 10 === 1 && count % 100 !== 11) return 'отзыв';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'отзыва';
    return 'отзывов';
  };

  return (
    <section id="author" className={css.sectionAuthor}>
      <Heading as="h2" rootClassName={css.sectionHeadingWithExtraMargin}>
        <FormattedMessage id="ListingPage.aboutProviderTitle" />
      </Heading>
      <UserCard
        user={listing.author}
        currentUser={currentUser}
        onContactUser={onContactUser}
        showContact={!isInquiryProcess}
      />
      
      {/* Рейтинг Provider'а */}
      {!loadingStats && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {rating > 0 ? (
            <>
              <StarRating rating={rating} />
              <span style={{ fontSize: 14, color: '#4a5568' }}>
                {rating.toFixed(1)} ({reviewCount} {getReviewWord(reviewCount)})
              </span>
            </>
          ) : (
            <span style={{ fontSize: 14, color: '#9ca3af' }}>
              Пока нет отзывов
            </span>
          )}
        </div>
      )}
      <Modal
        id="ListingPage.inquiry"
        contentClassName={css.inquiryModalContent}
        isOpen={isInquiryModalOpen}
        onClose={onCloseInquiryModal}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
      >
        <InquiryForm
          className={css.inquiryForm}
          submitButtonWrapperClassName={css.inquirySubmitButtonWrapper}
          listingTitle={title}
          authorDisplayName={authorDisplayName}
          sendInquiryError={sendInquiryError}
          onSubmit={onSubmitInquiry}
          inProgress={sendInquiryInProgress}
        />
      </Modal>
    </section>
  );
};

export default SectionAuthorMaybe;
