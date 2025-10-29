const {
  handleError,
  serialize,
} = require('../api-util/sdk');

const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;

  console.log('🔍 transition-privileged: transition =', bodyParams?.transition);
  console.log('🔍 transition-privileged: tx id =', bodyParams?.id?.uuid);

  // Для inquiry процесса (assignment-flow-v3) lineItems не нужны
  // Просто используем пустой массив
  const lineItems = [];

  // ✅ ИСПОЛЬЗУЕМ INTEGRATION SDK для реального privileged API
  // (обходит actor restrictions в процессе)
  const integrationSdk = sharetribeIntegrationSdk.createInstance({
    clientId: process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID,
    clientSecret: process.env.SHARETRIBE_SDK_CLIENT_SECRET,
  });

  console.log('🔍 transition-privileged: using Integration SDK');

  Promise.resolve(integrationSdk)
    .then(sdk => {
      // Omit listingId from params (transitions don't need it, transaction already has it)
      const { listingId, ...restParams } = bodyParams?.params || {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...restParams,
          lineItems,
        },
      };

      console.log('🔍 transition-privileged: calling SDK with body:', JSON.stringify({
        id: body.id?.uuid,
        transition: body.transition,
        paramsKeys: Object.keys(body.params || {}),
      }));

      if (isSpeculative) {
        return sdk.transactions.transitionSpeculative(body, queryParams);
      }
      return sdk.transactions.transition(body, queryParams);
    })
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      console.log('✅ transition-privileged: success, status =', status);
      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      console.error('❌ transition-privileged error:', e);
      handleError(res, e);
    });
};
