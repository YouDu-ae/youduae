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
const listingStatus = require('./api/listing-status');
const searchExecutors = require('./api/search-executors');
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
const updatePresence = require('./api/update-presence');
const presenceBatch = require('./api/presence-batch');
const placesProxy = require('./api/places-proxy');
const telegramBot = require('./api/telegram-bot');
const viewedTransactions = require('./api/viewed-transactions');

const createUserWithIdp = require('./api/auth/createUserWithIdp');
const createUser = require('./api/auth/createUser');
const login = require('./api/auth/login');
const mobileIdp = require('./api/auth/mobile-idp');
const { sendEmailOtp, verifyEmailOtp, assertEmailVerified } = require('./api/email-otp');

const { authenticateFacebook, authenticateFacebookCallback } = require('./api/auth/facebook');
const { authenticateGoogle, authenticateGoogleCallback } = require('./api/auth/google');
const { authenticateApple, authenticateAppleCallback } = require('./api/auth/apple');

const router = express.Router();

// ================ API router middleware: ================ //

// Parse JSON body with increased size limit for guest listing creation (images in base64)
router.use(
  bodyParser.json({
    limit: '50mb',
    type: 'application/json',
  })
);

// Parse Transit body first to a string
router.use(
  bodyParser.text({
    type: 'application/transit+json',
    limit: '50mb',
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
router.post('/create-guest-listing', createGuestListing);
router.get('/listing-status', listingStatus);
router.get('/search-executors', searchExecutors);
router.post('/create-my-executor-profile', createMyExecutorProfile);
router.post('/add-portfolio-item', addPortfolioItem);
router.get('/user-completed-transactions', userCompletedTransactions);
router.get('/platform-stats', platformStats);
router.get('/listing-responses', listingResponses);
router.post('/accept-offer', acceptOffer);
router.post('/complete-transaction', completeTransaction);
router.post('/register-device-token', registerDeviceToken);
router.post('/send-notification', sendNotification);
router.post('/notify-new-message', notifyNewMessage);
router.post('/notify-new-review', notifyNewReview);
router.post('/update-presence', updatePresence);
router.get('/presence-batch', presenceBatch);

// Google Places (для мобильного приложения — ключ на сервере, без referrer с телефона)
router.get('/places/autocomplete', placesProxy.autocomplete);
router.get('/places/details', placesProxy.details);

// Telegram Bot
router.post('/telegram/webhook', telegramBot.handleWebhook);
router.post('/telegram/generate-code', telegramBot.generateCode);
router.get('/telegram/status', telegramBot.checkTelegramStatus);
router.post('/telegram/unlink', telegramBot.unlinkTelegram);

// Viewed transactions (for syncing read/unread state across devices)
router.get('/viewed-transactions', viewedTransactions.getViewedTransactions);
router.post('/viewed-transactions', viewedTransactions.markTransactionViewed);
router.post('/viewed-transactions/batch', viewedTransactions.markTransactionsBatchViewed);

// Email OTP verification endpoints
router.post('/otp/email/send', sendEmailOtp);
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

module.exports = router;
