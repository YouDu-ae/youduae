/**
 * This file contains server side endpoints that can be used to perform backend
 * tasks that can not be handled in the browser.
 *
 * The endpoints should not clash with the application routes. Therefore, the
 * endpoints are prefixed in the main server where this file is used.
 */

const express = require('express');
const bodyParser = require('body-parser');
const { deserialize } = require('./api-util/sdk');
const {
  apiLimiter,
  expensiveLimiter,
  writeLimiter,
  placesLimiter,
} = require('./api-util/rateLimit');

const initiateLoginAs = require('./api/initiate-login-as');
const loginAs = require('./api/login-as');
const transactionLineItems = require('./api/transaction-line-items');
const initiatePrivileged = require('./api/initiate-privileged');
const transitionPrivileged = require('./api/transition-privileged');
const queryOffers = require('./api/query-offers');
const checkMyOffer = require('./api/check-my-offer');
const updateListingStatus = require('./api/update-listing-status');
const userReviewsStats = require('./api/user-reviews-stats');
const createGuestListing = require('./api/create-guest-listing');
const notifyNewListing = require('./api/notify-new-listing');
const listingStatus = require('./api/listing-status');
const searchExecutors = require('./api/search-executors');
const categorySpecialists = require('./api/category-specialists');
const createMyExecutorProfile = require('./api/create-my-executor-profile');
const addPortfolioItem = require('./api/add-portfolio-item');
const userCompletedTransactions = require('./api/user-completed-transactions');
const platformStats = require('./api/platform-stats');
const listingResponses = require('./api/listing-responses');
const acceptOffer = require('./api/accept-offer');
const completeTransaction = require('./api/complete-transaction');
const registerDeviceToken = require('./api/register-device-token');
const { handler: sendNotification } = require('./api/send-notification');
const notifyNewMessage = require('./api/notify-new-message');
const notifyNewReview = require('./api/notify-new-review');
const notifyPortfolioModeration = require('./api/notify-portfolio-moderation');
const notifyVerification = require('./api/notify-verification');
const placesProxy = require('./api/places-proxy');
const telegramBot = require('./api/telegram-bot');
const syncTelegramCategories = require('./api/sync-telegram-categories');
const telegramBlogWebhook = require('./api/telegram-blog-webhook');
const blogArticles = require('./api/blog-articles');
const viewedTransactions = require('./api/viewed-transactions');
const listingId = require('./api/listing-id');
const supportTickets = require('./api/support-tickets');
const blogAdmin = require('./api/blog-admin');
const database = require('./db');

const createUserWithIdp = require('./api/auth/createUserWithIdp');
const createUser = require('./api/auth/createUser');
const login = require('./api/auth/login');
const mobileIdp = require('./api/auth/mobile-idp');
const { sendEmailOtp, verifyEmailOtp, assertEmailVerified } = require('./api/email-otp');

const { authenticateFacebook, authenticateFacebookCallback } = require('./api/auth/facebook');
const { authenticateGoogle, authenticateGoogleCallback } = require('./api/auth/google');
const { authenticateApple, authenticateAppleCallback } = require('./api/auth/apple');

const { requireUser, attachUser } = require('./api-util/auth');

// Операторские маршруты закрыты той же сессией, что и админка блога: это
// единственная в проекте аутентификация сотрудника (пароль + подтверждение
// в Telegram), заводить вторую параллельную было бы хуже.
const requireOperator = blogAdmin.checkSession;

const router = express.Router();

// ================ API router middleware: ================ //

// Applied before the body parsers so a flood is rejected without paying the
// cost of reading and parsing large payloads.
router.use(apiLimiter);

// Parse JSON body with increased size limit for guest listing creation (images in base64)
router.use(
  bodyParser.json({
    limit: '12mb',
    type: 'application/json',
  })
);

// Parse Transit body first to a string
router.use(
  bodyParser.text({
    type: 'application/transit+json',
    limit: '12mb',
  })
);

// Deserialize Transit body string to JS data
router.use((req, res, next) => {
  if (req.get('Content-Type') === 'application/transit+json' && typeof req.body === 'string') {
    try {
      req.body = deserialize(req.body);
    } catch (e) {
      console.error('Failed to parse request body as Transit:');
      console.error(e);
      res.status(400).send('Invalid Transit in request body.');
      return;
    }
  }
  next();
});

// ================ API router endpoints: ================ //

router.get('/initiate-login-as', initiateLoginAs);
router.get('/login-as', loginAs);
router.post('/transaction-line-items', transactionLineItems);
router.post('/initiate-privileged', initiatePrivileged);
router.post('/transition-privileged', transitionPrivileged);
router.get('/query-offers', queryOffers);
router.get('/check-my-offer', checkMyOffer);
router.post('/update-listing-status', updateListingStatus);
router.get('/user-reviews-stats', userReviewsStats);
router.post('/create-guest-listing', writeLimiter, createGuestListing);
router.post('/notify-new-listing', writeLimiter, notifyNewListing);
router.get('/listing-status', listingStatus);
router.get('/search-executors', expensiveLimiter, searchExecutors);
router.get('/category-specialists', categorySpecialists);
router.post('/create-my-executor-profile', createMyExecutorProfile);
router.post('/add-portfolio-item', addPortfolioItem);
router.get('/user-completed-transactions', expensiveLimiter, userCompletedTransactions);
router.get('/platform-stats', expensiveLimiter, platformStats);
router.get('/listing-responses', expensiveLimiter, listingResponses);
router.post('/accept-offer', acceptOffer);
router.post('/complete-transaction', completeTransaction);
router.post('/register-device-token', registerDeviceToken);
router.post('/send-notification', writeLimiter, sendNotification);
router.post('/notify-new-message', notifyNewMessage);
router.post('/notify-new-review', notifyNewReview);
router.post('/notify-portfolio-moderation', requireUser, notifyPortfolioModeration);
router.post('/notify-verification', requireUser, notifyVerification);

// Google Places (для мобильного приложения — ключ на сервере, без referrer с телефона)
router.get('/places/autocomplete', placesLimiter, placesProxy.autocomplete);
router.get('/places/details', placesLimiter, placesProxy.details);

// Telegram Bot
router.post('/telegram/webhook', telegramBot.handleWebhook);
router.post('/telegram/generate-code', writeLimiter, telegramBot.generateCode);
router.get('/telegram/status', telegramBot.checkTelegramStatus);
router.post('/telegram/unlink', telegramBot.unlinkTelegram);
router.post('/telegram/sync-categories', writeLimiter, syncTelegramCategories);

// Telegram Blog integration
router.post('/telegram/blog-webhook', telegramBlogWebhook.handleBlogWebhook);
router.get('/blog/pending', requireOperator, telegramBlogWebhook.getPendingPosts);
router.post('/blog/approve', requireOperator, telegramBlogWebhook.approvePost);
router.post('/blog/reject', requireOperator, telegramBlogWebhook.rejectPost);

// Blog articles API
router.get('/blog/articles', blogArticles.getArticles);
router.get('/blog/articles/:slug', blogArticles.getArticleBySlug);

// Blog Admin API (with 2FA)
router.post('/blog/admin/auth', blogAdmin.authenticate);
router.post('/blog/admin/verify-2fa', blogAdmin.verify2FA);
router.get('/blog/admin/covers', blogAdmin.checkSession, blogAdmin.getCovers);
router.get('/blog/admin/articles', blogAdmin.checkSession, blogAdmin.getArticles(database));
router.post('/blog/admin/articles', blogAdmin.checkSession, blogAdmin.createArticle(database));
router.put('/blog/admin/articles/:id', blogAdmin.checkSession, blogAdmin.updateArticle(database));
router.delete(
  '/blog/admin/articles/:id',
  blogAdmin.checkSession,
  blogAdmin.deleteArticle(database)
);
router.post(
  '/blog/admin/articles/:id/publish',
  blogAdmin.checkSession,
  blogAdmin.publishArticle(database)
);

// Viewed transactions (for syncing read/unread state across devices)
router.get('/viewed-transactions', viewedTransactions.getViewedTransactions);
router.post('/viewed-transactions', viewedTransactions.markTransactionViewed);
router.post('/viewed-transactions/batch', viewedTransactions.markTransactionsBatchViewed);

// Email OTP verification endpoints
router.post('/otp/email/send', writeLimiter, sendEmailOtp);
router.post('/otp/email/verify', verifyEmailOtp);
router.post('/otp/email/assert', assertEmailVerified);

// Create user with identity provider (e.g. Facebook or Google)
// This endpoint is called to create a new user after user has confirmed
// they want to continue with the data fetched from IdP (e.g. name and email)
router.post('/auth/create-user-with-idp', createUserWithIdp);
router.post('/auth/create-user', createUser);
router.post('/auth/login', login);

// Mobile Google / Apple Sign-In: native ID token → Sharetribe tokens (JSON)
router.post('/auth/mobile-idp', mobileIdp);

// Facebook authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Facebook
router.get('/auth/facebook', authenticateFacebook);

// This is the route for callback URL the user is redirected after authenticating
// with Facebook. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/facebook/callback', authenticateFacebookCallback);

// Google authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Google
router.get('/auth/google', authenticateGoogle);

// This is the route for callback URL the user is redirected after authenticating
// with Google. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/google/callback', authenticateGoogleCallback);

// Apple authentication endpoints

// This endpoint is called when user wants to initiate authentication with Apple
router.get('/auth/apple', authenticateApple);

// This is the route for callback URL the user is redirected after authenticating
// with Apple. Note: Apple sends a POST request to the callback URL.
router.post('/auth/apple/callback', authenticateAppleCallback);

// Listing public ID endpoints (YD-00001 format)
router.post('/listing/generate-id', listingId.generateId);
router.post('/listing/save-mapping', listingId.saveMapping);
router.get('/listing/by-public-id/:publicId', listingId.getByPublicId);
router.get('/listing/public-id/:sharetribeUuid', listingId.getPublicId);
router.get('/listing/stats', listingId.getStats);

// Support tickets endpoints
router.post('/support/create', writeLimiter, attachUser, supportTickets.createTicket);
router.get('/support/ticket/:ticketId', requireUser, supportTickets.getTicket);
router.get('/support/my-tickets', requireUser, supportTickets.getMyTickets);
router.post('/support/reply', writeLimiter, requireUser, supportTickets.addUserReply);
router.post('/support/admin/reply', requireOperator, supportTickets.addAdminReply);
router.post('/support/admin/close', requireOperator, supportTickets.closeTicket);
router.get('/support/admin/open', requireOperator, supportTickets.getOpenTickets);
router.get('/support/stats', requireOperator, supportTickets.getStats);

// body-parser rejects oversized payloads before any route runs. Without this the
// client gets an HTML error page it cannot parse.
router.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    console.warn(`🚫 Payload too large: ${req.method} ${req.originalUrl}`);
    return res.status(413).json({
      error: 'Слишком большой запрос. Уменьшите количество или размер фотографий.',
    });
  }
  return next(err);
});

module.exports = router;
