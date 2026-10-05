/**
 * Value of one finished task in AED.
 *
 * In assignment-flow-v3 the agreed price lives in protectedData.offer.price and
 * is already in AED; the purchase and booking processes report payinTotal in
 * cents instead.
 */
const transactionValueAED = tx => {
  const payinTotal = tx.attributes.payinTotal;
  const offer = (tx.attributes.protectedData || {}).offer;

  if (payinTotal && payinTotal.currency === 'AED') {
    return payinTotal.amount / 100;
  }
  if (offer && offer.price && offer.currency === 'AED') {
    return offer.price;
  }
  return 0;
};

module.exports = { transactionValueAED };
