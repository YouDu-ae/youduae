import React, { useState, useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useIntl } from '../../util/reactIntl';
import { apiBaseUrl } from '../../util/api';

import { Page, LayoutSingleColumn, H2, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './SupportPage.module.css';

const CATEGORIES = [
  { id: 'general', labelId: 'SupportPage.categoryGeneral' },
  { id: 'listing', labelId: 'SupportPage.categoryListing' },
  { id: 'payment', labelId: 'SupportPage.categoryPayment' },
  { id: 'account', labelId: 'SupportPage.categoryAccount' },
  { id: 'technical', labelId: 'SupportPage.categoryTechnical' },
  { id: 'complaint', labelId: 'SupportPage.categoryComplaint' },
];

const TICKET_STATUS_LABEL_IDS = {
  open: 'SupportPage.statusOpen',
  pending: 'SupportPage.statusPending',
  closed: 'SupportPage.statusClosed',
};

const SupportPageComponent = props => {
  const { currentUser, scrollingDisabled } = props;
  const intl = useIntl();
  const locale = intl.locale || 'ru';

  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'general',
    relatedListingId: '',
    email: '',
    name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [error, setError] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const isLoggedIn = !!currentUser?.id;
  const userId = currentUser?.id?.uuid;
  const userEmail = currentUser?.attributes?.email;
  const userName = currentUser?.attributes?.profile?.displayName;

  useEffect(() => {
    if (isLoggedIn && userEmail) {
      setFormData(prev => ({
        ...prev,
        email: userEmail,
        name: userName || '',
      }));
    }
  }, [isLoggedIn, userEmail, userName]);

  useEffect(() => {
    if (userId) {
      setLoadingTickets(true);
      // Пользователя сервер определяет по сессии, передавать id клиенту не нужно
      fetch(`${apiBaseUrl()}/api/support/my-tickets`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setMyTickets(data.tickets || []);
          setLoadingTickets(false);
        })
        .catch(() => setLoadingTickets(false));
    }
  }, [userId]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl()}/api/support/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          message: formData.message,
          category: formData.category,
          relatedListingId: formData.relatedListingId || null,
          userEmail: formData.email,
          userName: formData.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        setTicketId(data.ticketId);
      } else {
        setError(data.error || intl.formatMessage({ id: 'SupportPage.errorSubmit' }));
      }
    } catch (err) {
      setError(intl.formatMessage({ id: 'SupportPage.errorNetwork' }));
    } finally {
      setSubmitting(false);
    }
  };

  const title = intl.formatMessage({ id: 'SupportPage.schemaTitle' });
  const description = intl.formatMessage({ id: 'SupportPage.schemaDescription' });

  return (
    <Page title={title} description={description} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.pageWrapper}>
          <div className={css.container}>
            <H2 className={css.pageTitle}>
              {intl.formatMessage({ id: 'SupportPage.title' })}
            </H2>

            <div className={css.telegramBlock}>
              <div className={css.telegramText}>
                {intl.formatMessage({ id: 'SupportPage.contactUs' })}
              </div>
              <a
                href="https://t.me/youdu_ae"
                target="_blank"
                rel="noopener noreferrer"
                className={css.telegramButton}
              >
                <svg className={css.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>

            {submitted ? (
              <div className={css.successMessage}>
                <div className={css.successIcon}>✅</div>
                <h3>{intl.formatMessage({ id: 'SupportPage.successTitle' })}</h3>
                <p>
                  {intl.formatMessage(
                    { id: 'SupportPage.successText' },
                    { ticketId, email: formData.email }
                  )}
                </p>
                <button 
                  className={css.newTicketButton}
                  onClick={() => {
                    setSubmitted(false);
                    setFormData(prev => ({ ...prev, subject: '', message: '', relatedListingId: '' }));
                  }}
                >
                  {intl.formatMessage({ id: 'SupportPage.newRequest' })}
                </button>
              </div>
            ) : (
              <form className={css.form} onSubmit={handleSubmit}>
                {!isLoggedIn && (
                  <>
                    <div className={css.formGroup}>
                      <label htmlFor="name">
                        {intl.formatMessage({ id: 'SupportPage.nameLabel' })}
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={intl.formatMessage({ id: 'SupportPage.namePlaceholder' })}
                      />
                    </div>
                    <div className={css.formGroup}>
                      <label htmlFor="email">
                        Email <span className={css.required}>*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="your@email.com"
                      />
                    </div>
                  </>
                )}

                <div className={css.formGroup}>
                  <label htmlFor="category">
                    {intl.formatMessage({ id: 'SupportPage.categoryLabel' })}
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {intl.formatMessage({ id: cat.labelId })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={css.formGroup}>
                  <label htmlFor="relatedListingId">
                    {intl.formatMessage({ id: 'SupportPage.relatedListingLabel' })}
                  </label>
                  <input
                    type="text"
                    id="relatedListingId"
                    name="relatedListingId"
                    value={formData.relatedListingId}
                    onChange={handleChange}
                    placeholder="YD-00001"
                  />
                </div>

                <div className={css.formGroup}>
                  <label htmlFor="subject">
                    {intl.formatMessage({ id: 'SupportPage.subjectLabel' })} <span className={css.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder={intl.formatMessage({ id: 'SupportPage.subjectPlaceholder' })}
                  />
                </div>

                <div className={css.formGroup}>
                  <label htmlFor="message">
                    {intl.formatMessage({ id: 'SupportPage.messageLabel' })} <span className={css.required}>*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    placeholder={intl.formatMessage({ id: 'SupportPage.messagePlaceholder' })}
                  />
                </div>

                {error && <div className={css.errorMessage}>{error}</div>}

                <button 
                  type="submit" 
                  className={css.submitButton}
                  disabled={submitting}
                >
                  {intl.formatMessage({
                    id: submitting ? 'SupportPage.submitting' : 'SupportPage.submit',
                  })}
                </button>
              </form>
            )}

            {isLoggedIn && myTickets.length > 0 && (
              <div className={css.myTickets}>
                <h3>{intl.formatMessage({ id: 'SupportPage.myRequests' })}</h3>
                <div className={css.ticketsList}>
                  {myTickets.map(ticket => (
                    <div key={ticket.ticket_id} className={css.ticketItem}>
                      <div className={css.ticketHeader}>
                        <span className={css.ticketId}>{ticket.ticket_id}</span>
                        <span className={`${css.ticketStatus} ${css[ticket.status]}`}>
                          {TICKET_STATUS_LABEL_IDS[ticket.status]
                            ? intl.formatMessage({ id: TICKET_STATUS_LABEL_IDS[ticket.status] })
                            : null}
                        </span>
                      </div>
                      <div className={css.ticketSubject}>{ticket.subject}</div>
                      <div className={css.ticketDate}>
                        {new Date(ticket.created_at).toLocaleDateString(locale)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={css.contactInfo}>
              <h3>{intl.formatMessage({ id: 'SupportPage.otherContacts' })}</h3>
              <p>
                <strong>Telegram:</strong>{' '}
                <a href="https://t.me/youdu_uae" target="_blank" rel="noopener noreferrer">
                  @youdu_uae
                </a>
              </p>
              <p>
                <strong>Email:</strong>{' '}
                <a href="mailto:support@youdu.ae">support@youdu.ae</a>
              </p>
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  return {
    currentUser,
    scrollingDisabled: false,
  };
};

const SupportPage = compose(connect(mapStateToProps))(SupportPageComponent);

export default SupportPage;
