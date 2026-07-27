import React, { useState, useEffect } from 'react';
import { useIntl } from '../../util/reactIntl';
import { useLocation, useHistory } from 'react-router-dom';
import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './BlogPage.module.css';

const BlogPage = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const locale = intl.locale || 'ru';

  const searchParams = new URLSearchParams(location.search);
  const activeCategory = searchParams.get('category') || 'all';

  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const url = activeCategory === 'all' 
          ? '/api/blog/articles'
          : `/api/blog/articles?category=${activeCategory}`;
        const response = await fetch(url);
        const data = await response.json();
        setCategories(data.categories || []);
        setArticles(data.articles || []);
      } catch (error) {
        console.error('Error loading articles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [activeCategory]);

  const filteredArticles = articles;

  const handleCategoryChange = (categoryId) => {
    if (categoryId === 'all') {
      history.push('/blog');
    } else {
      history.push(`/blog?category=${categoryId}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const pageTitle = locale === 'ru' 
    ? 'Блог YouDu — статьи о жизни и работе в ОАЭ' 
    : 'YouDu Blog — Articles about Life and Work in UAE';
  
  const pageDescription = locale === 'ru'
    ? 'Полезные статьи о ремонте, клининге, репетиторах и жизни в Дубае. Реальные кейсы, советы клиентам и специалистам.'
    : 'Useful articles about renovation, cleaning, tutors and life in Dubai. Real cases, tips for clients and specialists.';

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': pageTitle,
    'description': pageDescription,
    'url': 'https://youdu.ae/blog',
    'publisher': {
      '@type': 'Organization',
      'name': 'YouDu',
      'url': 'https://youdu.ae'
    }
  };

  return (
    <Page
      title={pageTitle}
      description={pageDescription}
      schema={schemaData}
    >
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className={css.pageWrapper}>
          <div className={css.container}>
            <h1 className={css.pageTitle}>
              {locale === 'ru' ? 'Блог' : 'Blog'}
            </h1>
            <p className={css.pageSubtitle}>
              {locale === 'ru' 
                ? 'Полезные статьи о жизни и работе в ОАЭ' 
                : 'Useful articles about life and work in UAE'}
            </p>

            {/* Category Tabs */}
            <div className={css.tabs}>
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`${css.tab} ${activeCategory === category.id ? css.tabActive : ''}`}
                  onClick={() => handleCategoryChange(category.id)}
                >
                  {category.name[locale] || category.name.ru}
                </button>
              ))}
            </div>

            {/* Articles Grid */}
            <div className={css.articlesGrid}>
              {filteredArticles.map(article => (
                <NamedLink
                  key={article.id}
                  name="BlogArticlePage"
                  params={{ slug: article.slug }}
                  className={css.articleCard}
                >
                  <div 
                    className={css.articleImage}
                    style={{ backgroundImage: `url(${article.image})` }}
                  >
                    <span className={css.categoryBadge}>
                      {categories.find(c => c.id === article.category)?.name[locale] || article.category}
                    </span>
                  </div>
                  <div className={css.articleContent}>
                    <h2 className={css.articleTitle}>
                      {article.title[locale] || article.title.ru}
                    </h2>
                    <p className={css.articleDescription}>
                      {article.description[locale] || article.description.ru}
                    </p>
                    <div className={css.articleMeta}>
                      <span className={css.articleDate}>
                        {formatDate(article.createdAt)}
                      </span>
                      <span className={css.articleReadTime}>
                        {article.readTime} {locale === 'ru' ? 'мин' : 'min'}
                      </span>
                    </div>
                  </div>
                </NamedLink>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className={css.noArticles}>
                {locale === 'ru' 
                  ? 'В этой рубрике пока нет статей' 
                  : 'No articles in this category yet'}
              </div>
            )}
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BlogPage;
