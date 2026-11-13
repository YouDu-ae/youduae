const { normalizeArticleLinks } = require('./articleLinks');

const link = href => `<p>Пишите <a href="${href}">сюда</a></p>`;

describe('normalizeArticleLinks', () => {
  it('turns a Telegram username into a t.me link', () => {
    expect(normalizeArticleLinks(link('@YouDuAE_bot'))).toEqual(link('https://t.me/YouDuAE_bot'));
  });

  it('adds https to a bare domain and drops utm parameters from own links', () => {
    const html =
      "<a href='youdu.ae/s?utm_source=telegram&utm_medium=social&utm_campaign=email_notify'>Лента</a>";
    expect(normalizeArticleLinks(html)).toEqual("<a href='https://youdu.ae/s'>Лента</a>");
    expect(normalizeArticleLinks(link('t.me/youdu_uae'))).toEqual(link('https://t.me/youdu_uae'));
    expect(normalizeArticleLinks(link('//youdu.ae/app'))).toEqual(link('https://youdu.ae/app'));
  });

  it('keeps other parameters of own links, escaped for HTML', () => {
    expect(
      normalizeArticleLinks(link('https://www.youdu.ae/s?utm_source=x&amp;keywords=a&amp;page=2'))
    ).toEqual(link('https://www.youdu.ae/s?keywords=a&amp;page=2'));
    expect(normalizeArticleLinks(link('https://youdu.ae/p/about?gclid=1#team'))).toEqual(
      link('https://youdu.ae/p/about#team')
    );
  });

  it('leaves valid and foreign links untouched', () => {
    [
      'https://example.com/?utm_source=x&amp;a=1',
      'https://youdu.ae/s?keywords=a&page=2',
      '/blog/prilozhenie-youdu-dlya-iphone',
      '#top',
      'mailto:support@youdu.ae',
      'tel:+971500000000',
    ].forEach(href => expect(normalizeArticleLinks(link(href))).toEqual(link(href)));
  });

  it('fixes every link in the content and ignores non-strings', () => {
    const html = '<a href="@one_bot">1</a> и <a class="x" href="youdu.ae">2</a>';
    expect(normalizeArticleLinks(html)).toEqual(
      '<a href="https://t.me/one_bot">1</a> и <a class="x" href="https://youdu.ae">2</a>'
    );
    expect(normalizeArticleLinks(undefined)).toBeUndefined();
  });
});
