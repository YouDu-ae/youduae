import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useIntl } from '../../util/reactIntl';
import { blogCoverUrl, blogCoverAbsoluteUrl } from '../../util/blog';
import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import NotFoundPage from '../NotFoundPage/NotFoundPage';

import css from './BlogArticlePage.module.css';

const BlogArticlePage = props => {
  const intl = useIntl();
  const locale = intl.locale || 'ru';

  // Статью грузит loadData — и на сервере, и при переходах на клиенте
  const { article, categories, fetchInProgress, fetchArticleError, articleNotFound } = useSelector(
    state => state.BlogArticlePage
  );

  if (articleNotFound || fetchArticleError) {
    // staticContext даёт серверу вернуть настоящий 404 вместо 200 с текстом ошибки
    return <NotFoundPage staticContext={props.staticContext} />;
  }

  if (fetchInProgress || !article) {
    // Заголовок здесь не должен быть техническим: если серверная загрузка
    // почему-то не успела, именно он уйдёт в превью ссылки и в выдачу.
    const fallbackTitle =
      locale === 'ru' ? 'Блог YouDu — статьи о жизни и работе в ОАЭ' : 'YouDu Blog';

    return (
      <Page title={fallbackTitle}>
        <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
          <div className={css.pageWrapper}>
            <div className={css.container} style={{ textAlign: 'center', padding: '100px 20px' }}>
              {locale === 'ru' ? 'Загрузка...' : 'Loading...'}
            </div>
          </div>
        </LayoutSingleColumn>
      </Page>
    );
  }

  const category = categories.find(c => c.id === article.category);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const articleTitle = article.title[locale] || article.title.ru;
  const articleDescription = article.description[locale] || article.description.ru;
  
  const pageTitle = `${articleTitle} — YouDu Blog`;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': articleTitle,
    'description': articleDescription,
    'image': blogCoverAbsoluteUrl(article),
    'datePublished': article.createdAt,
    'timeRequired': `PT${article.readTime || 5}M`,
    'keywords': article.keywords || '',
    'author': article.author ? {
      '@type': 'Person',
      'name': article.author.name
    } : {
      '@type': 'Organization',
      'name': 'YouDu'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'YouDu',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://youdu.ae/static/icons/logo.png'
      }
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `https://youdu.ae/blog/${article.slug}`
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': locale === 'ru' ? 'Главная' : 'Home',
        'item': 'https://youdu.ae'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': locale === 'ru' ? 'Блог' : 'Blog',
        'item': 'https://youdu.ae/blog'
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': articleTitle,
        'item': `https://youdu.ae/blog/${article.slug}`
      }
    ]
  };

  const relatedArticles = []; // TODO: fetch related articles

  let articleContent = null;
  if (article.content) {
    articleContent = article.content[locale] || article.content.ru;
  }
  if (!articleContent) {
    articleContent = `<p>${articleDescription}</p><p>${locale === 'ru' ? 'Полный текст статьи скоро появится.' : 'Full article text coming soon.'}</p>`;
  }

  return (
    <Page
      title={pageTitle}
      description={articleDescription}
      schema={[schemaData, breadcrumbSchema]}
      facebookImages={[{ url: blogCoverAbsoluteUrl(article) }]}
      twitterImages={[{ url: blogCoverAbsoluteUrl(article) }]}
    >
      {/* Additional SEO meta tags */}
      {article.keywords && (
        <Helmet>
          <meta name="keywords" content={article.keywords} />
        </Helmet>
      )}
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className={css.pageWrapper}>
          {/* Breadcrumbs */}
          <div className={css.breadcrumbs}>
            <div className={css.container}>
              <NamedLink name="LandingPage" className={css.breadcrumbLink}>
                {locale === 'ru' ? 'Главная' : 'Home'}
              </NamedLink>
              <span className={css.breadcrumbSeparator}>/</span>
              <NamedLink name="BlogPage" className={css.breadcrumbLink}>
                {locale === 'ru' ? 'Блог' : 'Blog'}
              </NamedLink>
              <span className={css.breadcrumbSeparator}>/</span>
              <span className={css.breadcrumbCurrent}>
                {category?.name[locale] || category?.name.ru}
              </span>
            </div>
          </div>

          {/* Hero */}
          <div 
            className={css.hero}
            style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${blogCoverUrl(article)})` }}
          >
            <div className={css.container}>
              <span className={css.categoryBadge}>
                {category?.name[locale] || category?.name.ru}
              </span>
              <h1 className={css.title}>{articleTitle}</h1>
              <div className={css.meta}>
                <span className={css.metaDate}>{formatDate(article.createdAt)}</span>
                <span className={css.metaSeparator}>•</span>
                <span className={css.metaReadTime}>
                  {article.readTime} {locale === 'ru' ? 'мин чтения' : 'min read'}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <article className={css.article}>
            <div className={css.container}>
              <div 
                className={css.content}
                dangerouslySetInnerHTML={{ __html: articleContent }}
              />

              {/* Author Card (for cases) */}
              {article.author && (
                <div className={css.authorCard}>
                  <div className={css.authorInfo}>
                    <div className={css.authorAvatar}>
                      {article.author.name.charAt(0)}
                    </div>
                    <div className={css.authorDetails}>
                      <div className={css.authorName}>
                        {article.author.name}
                        {article.author.isVerified && (
                          <span className={css.verifiedBadge}>✓</span>
                        )}
                      </div>
                      <div className={css.authorSpecialty}>
                        {article.author.specialty[locale] || article.author.specialty.ru}
                      </div>
                      {article.author.rating && (
                        <div className={css.authorRating}>
                          ⭐ {article.author.rating}
                        </div>
                      )}
                    </div>
                  </div>
                  {article.author.profileId && (
                    <NamedLink 
                      name="ProfilePage" 
                      params={{ id: article.author.profileId }}
                      className={css.authorLink}
                    >
                      {locale === 'ru' ? 'Посмотреть профиль' : 'View Profile'}
                    </NamedLink>
                  )}
                </div>
              )}

              {/* Related Category CTA */}
              {article.relatedCategory && (
                <div className={css.ctaBlock}>
                  <h3 className={css.ctaTitle}>
                    {locale === 'ru' 
                      ? `Ищете специалиста?` 
                      : `Looking for a specialist?`}
                  </h3>
                  <p className={css.ctaText}>
                    {locale === 'ru'
                      ? `Найдите проверенных мастеров в категории "${article.relatedCategory.name.ru}"`
                      : `Find verified specialists in "${article.relatedCategory.name.en}" category`}
                  </p>
                  <NamedLink 
                    name="CategoryExecutorsPage" 
                    params={{ categoryId: article.relatedCategory.id }}
                    className={css.ctaButton}
                  >
                    {locale === 'ru' ? 'Найти специалиста' : 'Find Specialist'}
                  </NamedLink>
                </div>
              )}

              {/* Related Articles */}
              {relatedArticles.length > 0 && (
                <div className={css.relatedSection}>
                  <h3 className={css.relatedTitle}>
                    {locale === 'ru' ? 'Читайте также' : 'Related Articles'}
                  </h3>
                  <div className={css.relatedGrid}>
                    {relatedArticles.map(relatedArticle => (
                      <NamedLink
                        key={relatedArticle.id}
                        name="BlogArticlePage"
                        params={{ slug: relatedArticle.slug }}
                        className={css.relatedCard}
                      >
                        <div 
                          className={css.relatedImage}
                          style={{ backgroundImage: `url(${blogCoverUrl(relatedArticle)})` }}
                        />
                        <div className={css.relatedContent}>
                          <h4 className={css.relatedArticleTitle}>
                            {relatedArticle.title[locale] || relatedArticle.title.ru}
                          </h4>
                          <span className={css.relatedReadTime}>
                            {relatedArticle.readTime} {locale === 'ru' ? 'мин' : 'min'}
                          </span>
                        </div>
                      </NamedLink>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Blog */}
              <div className={css.backLink}>
                <NamedLink name="BlogPage" className={css.backButton}>
                  ← {locale === 'ru' ? 'Все статьи' : 'All Articles'}
                </NamedLink>
              </div>
            </div>
          </article>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BlogArticlePage;
