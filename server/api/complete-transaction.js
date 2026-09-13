const { trustedSdkFromBearer, BearerAuthError } = require('../api-util/mobileSdk');
const { isCompletedOrBeyond, isInvalidTransitionError } = require('../api-util/assignmentState');

/**
 * Mark the work done — mobile API endpoint.
 *
 * transition/complete names the provider (the task author) as its actor, so the
 * caller's own trusted SDK is the right tool. An earlier version reached for
 * transition/operator-complete through the Integration API, which cannot work:
 * assignment-flow-v3 declares no operator transitions at all. It then reported
 * the resulting error as success, so the app believed work had been completed
 * when nothing had moved.
 *
 * Reading the transaction first also settles authorisation: Sharetribe only
 * shows a transaction to its own parties.
 */
const lastTransitionOf = response => response?.data?.data?.attributes?.lastTransition;

module.exports = async (req, res) => {
  const { transactionId } = req.body;

  console.log('📱 complete-transaction: Starting for transaction:', transactionId);

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' }).end();
  }

  try {
    const trustedSdk = await trustedSdkFromBearer(req);

    const current = await trustedSdk.transactions.show({ id: transactionId });
    const currentTransition = lastTransitionOf(current);

    console.log('📊 complete-transaction: current state:', currentTransition);

    if (isCompletedOrBeyond(currentTransition)) {
      console.log('✅ complete-transaction: already completed, nothing to do');
      return res
        .status(200)
        .json({
          success: true,
          alreadyCompleted: true,
          message: 'Transaction already completed',
          currentState: currentTransition,
        })
        .end();
    }

    let transitionResponse;
    try {
      transitionResponse = await trustedSdk.transactions.transition({
        id: transactionId,
        transition: 'transition/complete',
        params: {},
      });
    } catch (error) {
      if (!isInvalidTransitionError(error)) throw error;

      // Someone may have completed it between the read above and this call.
      // Anything else genuinely failed and must be reported as such.
      const recheck = await trustedSdk.transactions.show({ id: transactionId });
      const recheckedTransition = lastTransitionOf(recheck);

      if (isCompletedOrBeyond(recheckedTransition)) {
        console.log('✅ complete-transaction: completed by a parallel request');
        return res
          .status(200)
          .json({
            success: true,
            alreadyCompleted: true,
            message: 'Transaction already completed',
            currentState: recheckedTransition,
          })
          .end();
      }

      console.error(
        '❌ complete-transaction: cannot complete from state',
        recheckedTransition
      );
      throw error;
    }

    console.log('✅ complete-transaction: completed');

    res
      .status(200)
      .json({
        success: true,
        message: 'Transaction completed',
        data: transitionResponse.data,
      })
      .end();
  } catch (error) {
    if (error instanceof BearerAuthError) {
      console.log('❌ complete-transaction:', error.message);
      return res
        .status(401)
        .json({ error: 'Authorization required', message: error.message })
        .end();
    }

    console.error(
      '❌ complete-transaction error:',
      error?.status,
      error?.data?.errors || error.message
    );

    res.status(error?.status || 500).json({
      error: error?.data?.errors?.[0]?.title || 'Failed to complete transaction',
      details: error?.data?.errors || error.message,
    }).end();
  }
};
