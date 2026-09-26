const { offerEmail, messageEmail, transitionEmail, TRANSITION_LETTERS } = require('./dealEmails');

const rootUrl = 'https://youdu.ae';

describe('deal e-mails', () => {
  it('escapes what users wrote', () => {
    const letter = messageEmail({
      rootUrl,
      recipientName: 'Alex',
      senderName: '<b>Ahmad</b>',
      listingTitle: 'Кран & смеситель',
      preview: '<script>alert(1)</script>',
      conversationUrl: `${rootUrl}/sale/tx-1`,
    });
    expect(letter.html).not.toContain('<script>');
    expect(letter.html).toContain('&lt;script&gt;');
    expect(letter.html).toContain('Кран &amp; смеситель');
    expect(letter.html).toContain(`href="${rootUrl}/sale/tx-1"`);
  });

  it('asks the reader to verify their e-mail', () => {
    const letter = offerEmail({
      rootUrl,
      recipientName: 'Alex',
      listingTitle: 'Установить выключатель',
      executorName: 'Ahmad Said',
      price: 150,
      currency: 'AED',
      listingUrl: `${rootUrl}/l/listing-1`,
    });
    expect(letter.subject).toBe('Новый отклик на задание «Установить выключатель»');
    expect(letter.html).toContain('150 AED');
    expect(letter.html).toContain(`${rootUrl}/account/contact-details`);
    expect(letter.text).toContain(`${rootUrl}/l/listing-1`);
  });

  it('links each step to the page of the party who receives it', () => {
    const letter = transition => transitionEmail({
      rootUrl,
      transition,
      recipientName: 'R',
      otherName: 'O',
      listingTitle: 'T',
      transactionId: 'tx-1',
    });
    expect(letter('transition/accept-offer').html).toContain(`${rootUrl}/order/tx-1`);
    expect(letter('transition/review-1-by-customer').html).toContain(`${rootUrl}/sale/tx-1`);
    expect(letter('transition/decline-offer').html).toContain(`${rootUrl}/s"`);
    expect(Object.keys(TRANSITION_LETTERS)).toHaveLength(7);
  });
});
