const sanitizeProps = props => {
  if (!props) return undefined;
  return Object.fromEntries(
    Object.entries(props).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === 'number' && Number.isNaN(value)) &&
        value !== ''
    )
  );
};

export const trackPlausible = (eventName, props) => {
  if (typeof window === 'undefined') {
    return;
  }

  const plausible = window.plausible || window.Plausible;
  if (typeof plausible !== 'function') {
    return;
  }

  const sanitized = sanitizeProps(props);
  if (sanitized) {
    plausible(eventName, { props: sanitized });
  } else {
    plausible(eventName);
  }
};

const listingProps = listingResource => {
  if (!listingResource) {
    return {};
  }

  const attributes = listingResource.attributes || {};
  const publicData = attributes.publicData || {};
  const geolocation = attributes.geolocation || {};
  const price = attributes.price || {};

  return sanitizeProps({
    listingId: listingResource.id?.uuid || listingResource.id,
    title: attributes.title,
    category: publicData.category,
    subcategory: publicData.subcategory,
    status: attributes.state,
    city: publicData.city || publicData.location?.city,
    location: publicData.location?.address || publicData.location?.city,
    priceAmount: typeof price.amount === 'number' ? price.amount : undefined,
    priceCurrency: price.currency,
  });
};

export const trackListingView = (listing, extra = {}) => {
  const props = {
    ...listingProps(listing),
    viewerRole: extra.viewerRole,
    viewerId: extra.viewerId,
  };
  trackPlausible('listing_view', props);
};

export const trackListingCreated = (listing, { stage = 'draft' } = {}) => {
  const props = {
    ...listingProps(listing),
    stage,
  };
  trackPlausible('listing_created', props);
};

export const trackOfferSubmitted = params => {
  const props = sanitizeProps({
    listingId: params?.listingId,
    priceAmount: params?.priceAmount,
    priceCurrency: params?.priceCurrency,
    commentLength: params?.commentLength,
    hasComment: params?.hasComment,
    processAlias: params?.processAlias,
    listingStatus: params?.listingStatus,
    userId: params?.userId,
    category: params?.category,
    city: params?.city,
  });
  trackPlausible('offer_submitted', props);
};

export const trackProviderSelected = params => {
  const props = sanitizeProps({
    listingId: params?.listingId,
    transactionId: params?.transactionId,
    providerId: params?.providerId,
    offerPriceAmount: params?.priceAmount,
    offerPriceCurrency: params?.priceCurrency,
  });
  trackPlausible('provider_selected', props);
};

export const trackMessageSent = params => {
  const props = sanitizeProps({
    transactionId: params?.transactionId,
    listingId: params?.listingId,
    messageLength: params?.messageLength,
    hasAttachment: params?.hasAttachment,
  });
  trackPlausible('message_sent', props);
};

export const trackJobCompleted = params => {
  const props = sanitizeProps({
    transactionId: params?.transactionId,
    listingId: params?.listingId,
  });
  trackPlausible('job_completed', props);
};

export const trackReviewSubmitted = params => {
  const props = sanitizeProps({
    transactionId: params?.transactionId,
    listingId: params?.listingId,
    rating: params?.rating,
    role: params?.role,
  });
  trackPlausible('review_submitted', props);
};

export const trackKycStarted = params => {
  const props = sanitizeProps({
    userId: params?.userId,
    documentType: params?.documentType,
  });
  trackPlausible('kyc_started', props);
};

export const trackSubscriptionStarted = params => {
  trackPlausible('subscription_started', sanitizeProps(params));
};

export const trackPaymentSucceeded = params => {
  trackPlausible('payment_succeeded', sanitizeProps(params));
};

