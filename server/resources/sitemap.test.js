const http = require('http');
const express = require('express');

const mockGetSpecialistsSummary = jest.fn();
const mockGetArticles = jest.fn();

jest.mock('../api-util/specialistsSummary.js', () => ({
  getSpecialistsSummary: (...args) => mockGetSpecialistsSummary(...args),
  hasIntegrationCredentials: () => true,
}));
jest.mock('../api-util/sdk.js', () => ({
  getSdk: () => ({}),
  // No access-control asset means a public marketplace
  fetchAccessControlAsset: () => Promise.resolve({ data: { data: [] } }),
}));
jest.mock('../db', () => ({
  getArticles: (...args) => mockGetArticles(...args),
}));
jest.mock('../log.js', () => ({ error: jest.fn() }));
jest.mock('../api-util/notifyListingPublished.js', () => ({
  CATEGORY_LABELS: { repairs_main: 'Ремонт и строительство', Delivery: 'Курьерские услуги' },
}));

const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

describe('sitemap', () => {
  let server;
  let baseUrl;

  beforeAll(done => {
    process.env.REACT_APP_MARKETPLACE_ROOT_URL = 'https://youdu.ae';
    process.env.REACT_APP_SHARETRIBE_USING_SSL = 'true';
    process.env.DATABASE_URL = 'postgres://sitemap-test';
    const sitemapResourceRoute = require('./sitemap');

    const app = express();
    app.get('/sitemap-:resource', sitemapResourceRoute);
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll(done => {
    delete process.env.DATABASE_URL;
    delete process.env.REACT_APP_SHARETRIBE_USING_SSL;
    delete process.env.REACT_APP_MARKETPLACE_ROOT_URL;
    server.close(done);
  });

  const get = path =>
    new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${path}`, response => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', chunk => (body += chunk));
          response.on('end', () => resolve(body));
        })
        .on('error', reject);
    });

  it('links the specialists and blog sitemaps from the index', async () => {
    expect(locs(await get('/sitemap-index.xml'))).toEqual([
      'https://youdu.ae/sitemap-default.xml',
      'https://youdu.ae/sitemap-recent-listings.xml',
      'https://youdu.ae/sitemap-recent-pages.xml',
      'https://youdu.ae/sitemap-specialists.xml',
      'https://youdu.ae/sitemap-blog.xml',
    ]);
  });

  it('lists site categories that have specialists, then the specialists themselves', async () => {
    mockGetSpecialistsSummary.mockResolvedValue({
      total: 2,
      avatars: [],
      categories: {
        repairs_main: { count: 2, avatars: [] },
        construction: { count: 1, avatars: [] },
      },
      profileIds: ['u-1', 'u-2'],
    });

    expect(locs(await get('/sitemap-specialists.xml'))).toEqual([
      'https://youdu.ae/category/repairs_main',
      'https://youdu.ae/u/u-1',
      'https://youdu.ae/u/u-2',
    ]);
  });

  it('lists published blog articles', async () => {
    mockGetArticles.mockResolvedValue([{ slug: 'kak-nayti-mastera' }, { slug: 'remont-v-dubae' }]);

    expect(locs(await get('/sitemap-blog.xml'))).toEqual([
      'https://youdu.ae/blog/kak-nayti-mastera',
      'https://youdu.ae/blog/remont-v-dubae',
    ]);
  });
});
