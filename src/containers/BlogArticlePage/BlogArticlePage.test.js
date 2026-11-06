import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { FOUNDER_ID } from '../../util/founder';

import BlogArticlePage from './BlogArticlePage';

const { screen, waitFor } = testingLibrary;

const AUTHOR_PHOTO = '/static/about/team/aleksandr-gross.jpg';

const article = {
  id: 'news-1',
  slug: 'news-1',
  category: 'telegram-news',
  title: { ru: 'Новость', en: 'News' },
  description: { ru: 'Описание', en: 'Description' },
  content: { ru: '<p>Текст</p>', en: '<p>Text</p>' },
  image: null,
  readTime: 3,
  keywords: '',
  author: { name: 'Александр Гросс', avatar: AUTHOR_PHOTO },
  createdAt: '2026-11-06',
};

const pageSchema = async () => {
  await waitFor(() => expect(document.getElementById('page-schema')).not.toBeNull(), {
    timeout: 3000,
  });
  return JSON.parse(document.getElementById('page-schema').textContent)['@graph'];
};

const stateWith = articleData => ({
  BlogArticlePage: {
    article: articleData,
    categories: [{ id: 'telegram-news', name: { ru: 'Телеграм новости', en: 'Telegram News' } }],
    fetchInProgress: false,
    fetchArticleError: null,
    articleNotFound: false,
  },
});

describe('BlogArticlePage', () => {
  // The API gives an author only a name and a photo: no specialty, rating or profile
  it('shows the author by the date and in the author card', () => {
    const { container } = render(<BlogArticlePage />, { initialState: stateWith(article) });

    expect(screen.getAllByText('Александр Гросс')).toHaveLength(2);
    expect(container.querySelector(`img[src="${AUTHOR_PHOTO}"]`)).toBeInTheDocument();
  });

  it('shows the first letter of the name when the author has no photo', () => {
    const noPhoto = { ...article, author: { name: 'Александр Гросс', avatar: null } };
    const { container } = render(<BlogArticlePage />, { initialState: stateWith(noPhoto) });

    expect(screen.getByText('А')).toBeInTheDocument();
    expect(container.querySelector(`img[src="${AUTHOR_PHOTO}"]`)).not.toBeInTheDocument();
  });

  it('shows no author when the article has none', () => {
    render(<BlogArticlePage />, { initialState: stateWith({ ...article, author: null }) });

    expect(screen.queryByText('Александр Гросс')).not.toBeInTheDocument();
  });

  it('marks up the founder as the author and as the founder of the site', async () => {
    render(<BlogArticlePage />, { initialState: stateWith(article) });

    const graph = await pageSchema();
    const articleNode = graph.find(node => node['@type'] === 'Article');
    const organization = graph.find(node => node['@type'] === 'Organization');

    expect(articleNode.author).toMatchObject({
      '@id': FOUNDER_ID,
      name: 'Александр Гросс',
      url: 'https://youdu.ae/p/about',
    });
    expect(articleNode.author.sameAs).toHaveLength(2);
    expect(organization.founder).toMatchObject({ '@id': FOUNDER_ID, name: 'Aleksandr Gross' });
  });

  it('marks up any other author by name only', async () => {
    const otherAuthor = { ...article, author: { name: 'Мария Иванова', avatar: null } };
    render(<BlogArticlePage />, { initialState: stateWith(otherAuthor) });

    const graph = await pageSchema();
    const articleNode = graph.find(node => node['@type'] === 'Article');

    expect(articleNode.author).toEqual({ '@type': 'Person', name: 'Мария Иванова' });
  });
});
