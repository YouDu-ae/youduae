import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './BlogAdminPage.module.css';

const CATEGORIES = [
  { id: 'cases', name: 'Реальные проекты' },
  { id: 'client-guide', name: 'Гид клиента' },
  { id: 'specialist-guide', name: 'Гид специалиста' },
  { id: 'uae-life', name: 'Жизнь в ОАЭ' },
  { id: 'telegram-news', name: 'Телеграм новости' },
];

const BlogAdminPage = () => {
  const history = useHistory();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [editingArticle, setEditingArticle] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const contentRef = useRef(null);

  const [formData, setFormData] = useState({
    title_ru: '',
    title_en: '',
    slug: '',
    category_id: 'cases',
    description_ru: '',
    description_en: '',
    content_ru: '',
    content_en: '',
    image: '',
    gallery: [],
    read_time: 5,
    author_name: '',
    featured: false,
    status: 'draft',
  });

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('blogAdminAuth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      loadArticles();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/blog/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (response.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem('blogAdminAuth', 'true');
        loadArticles();
      } else {
        alert('Неверный пароль');
      }
    } catch (error) {
      alert('Ошибка авторизации');
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/blog/admin/articles');
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title_ru: title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const insertFormatting = (tag) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content_ru;
    const selectedText = text.substring(start, end);

    let newText;
    let cursorOffset;

    switch (tag) {
      case 'h2':
        newText = text.substring(0, start) + `<h2>${selectedText || 'Заголовок'}</h2>\n` + text.substring(end);
        cursorOffset = start + 4;
        break;
      case 'h3':
        newText = text.substring(0, start) + `<h3>${selectedText || 'Подзаголовок'}</h3>\n` + text.substring(end);
        cursorOffset = start + 4;
        break;
      case 'p':
        newText = text.substring(0, start) + `<p>${selectedText || 'Текст параграфа'}</p>\n` + text.substring(end);
        cursorOffset = start + 3;
        break;
      case 'strong':
        newText = text.substring(0, start) + `<strong>${selectedText || 'жирный текст'}</strong>` + text.substring(end);
        cursorOffset = start + 8;
        break;
      case 'img':
        const imgUrl = prompt('Введите URL изображения:');
        if (imgUrl) {
          newText = text.substring(0, start) + `<img src="${imgUrl}" alt="Описание" />\n` + text.substring(end);
          cursorOffset = start + 10 + imgUrl.length;
        } else {
          return;
        }
        break;
      case 'gallery':
        newText = text.substring(0, start) + `<div class="image-gallery">\n  <img src="URL_1" alt="" />\n  <img src="URL_2" alt="" />\n</div>\n` + text.substring(end);
        cursorOffset = start + 35;
        break;
      case 'blockquote':
        newText = text.substring(0, start) + `<blockquote>${selectedText || 'Цитата'}</blockquote>\n` + text.substring(end);
        cursorOffset = start + 12;
        break;
      case 'ul':
        newText = text.substring(0, start) + `<ul>\n  <li>Пункт 1</li>\n  <li>Пункт 2</li>\n  <li>Пункт 3</li>\n</ul>\n` + text.substring(end);
        cursorOffset = start + 10;
        break;
      case 'table':
        newText = text.substring(0, start) + `<table>\n  <tr><td>Название</td><td>Значение</td></tr>\n  <tr><td>Пункт 1</td><td>100 AED</td></tr>\n  <tr><th>Итого</th><th>100 AED</th></tr>\n</table>\n` + text.substring(end);
        cursorOffset = start + 15;
        break;
      default:
        return;
    }

    setFormData(prev => ({ ...prev, content_ru: newText }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorOffset, cursorOffset);
    }, 10);
  };

  const addGalleryImage = () => {
    const url = prompt('Введите URL изображения:');
    if (url) {
      setFormData(prev => ({
        ...prev,
        gallery: [...prev.gallery, url],
      }));
    }
  };

  const removeGalleryImage = (index) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');

    try {
      const url = editingArticle 
        ? `/api/blog/admin/articles/${editingArticle.id}`
        : '/api/blog/admin/articles';
      
      const method = editingArticle ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSaveStatus('saved');
        loadArticles();
        setTimeout(() => {
          setActiveTab('list');
          resetForm();
          setSaveStatus(null);
        }, 1500);
      } else {
        const error = await response.json();
        setSaveStatus('error');
        alert('Ошибка: ' + (error.message || 'Не удалось сохранить'));
      }
    } catch (error) {
      setSaveStatus('error');
      alert('Ошибка сохранения: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title_ru: '',
      title_en: '',
      slug: '',
      category_id: 'cases',
      description_ru: '',
      description_en: '',
      content_ru: '',
      content_en: '',
      image: '',
      gallery: [],
      read_time: 5,
      author_name: '',
      featured: false,
      status: 'draft',
    });
    setEditingArticle(null);
  };

  const handleEdit = (article) => {
    setFormData({
      title_ru: article.title_ru || '',
      title_en: article.title_en || '',
      slug: article.slug || '',
      category_id: article.category_id || 'cases',
      description_ru: article.description_ru || '',
      description_en: article.description_en || '',
      content_ru: article.content_ru || '',
      content_en: article.content_en || '',
      image: article.image || '',
      gallery: article.gallery || [],
      read_time: article.read_time || 5,
      author_name: article.author_name || '',
      featured: article.featured || false,
      status: article.status || 'draft',
    });
    setEditingArticle(article);
    setActiveTab('editor');
  };

  const handleDelete = async (articleId) => {
    if (!confirm('Удалить статью?')) return;

    try {
      const response = await fetch(`/api/blog/admin/articles/${articleId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        loadArticles();
      }
    } catch (error) {
      alert('Ошибка удаления');
    }
  };

  const handlePublish = async (articleId) => {
    try {
      const response = await fetch(`/api/blog/admin/articles/${articleId}/publish`, {
        method: 'POST',
      });
      if (response.ok) {
        loadArticles();
      }
    } catch (error) {
      alert('Ошибка публикации');
    }
  };

  if (!isAuthenticated) {
    return (
      <Page title="Админка блога — YouDu">
        <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
          <div className={css.loginWrapper}>
            <form onSubmit={handleLogin} className={css.loginForm}>
              <h1>Админка блога</h1>
              <input
                type="password"
                placeholder="Пароль администратора"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className={css.passwordInput}
              />
              <button type="submit" className={css.loginButton}>
                Войти
              </button>
            </form>
          </div>
        </LayoutSingleColumn>
      </Page>
    );
  }

  return (
    <Page title="Админка блога — YouDu">
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.adminWrapper}>
          <div className={css.header}>
            <h1>Админка блога</h1>
            <div className={css.tabs}>
              <button
                className={`${css.tab} ${activeTab === 'list' ? css.activeTab : ''}`}
                onClick={() => { setActiveTab('list'); resetForm(); }}
              >
                Все статьи ({articles.length})
              </button>
              <button
                className={`${css.tab} ${activeTab === 'editor' ? css.activeTab : ''}`}
                onClick={() => { setActiveTab('editor'); resetForm(); }}
              >
                {editingArticle ? 'Редактирование' : '+ Новая статья'}
              </button>
            </div>
          </div>

          {activeTab === 'list' && (
            <div className={css.articlesList}>
              {loading ? (
                <p>Загрузка...</p>
              ) : articles.length === 0 ? (
                <p className={css.emptyState}>Статей пока нет. Создайте первую!</p>
              ) : (
                <table className={css.table}>
                  <thead>
                    <tr>
                      <th>Обложка</th>
                      <th>Название</th>
                      <th>Категория</th>
                      <th>Статус</th>
                      <th>Дата</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map(article => (
                      <tr key={article.id}>
                        <td>
                          {article.image ? (
                            <img src={article.image} alt="" className={css.thumbnail} />
                          ) : (
                            <div className={css.noImage}>No img</div>
                          )}
                        </td>
                        <td>
                          <strong>{article.title_ru}</strong>
                          <br />
                          <small className={css.slug}>/{article.slug}</small>
                        </td>
                        <td>{CATEGORIES.find(c => c.id === article.category_id)?.name || article.category_id}</td>
                        <td>
                          <span className={`${css.status} ${css[article.status]}`}>
                            {article.status === 'published' ? 'Опубликовано' : 
                             article.status === 'draft' ? 'Черновик' : article.status}
                          </span>
                        </td>
                        <td>{new Date(article.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>
                          <div className={css.actions}>
                            <button onClick={() => handleEdit(article)} className={css.editBtn}>
                              Ред.
                            </button>
                            {article.status !== 'published' && (
                              <button onClick={() => handlePublish(article.id)} className={css.publishBtn}>
                                Опубл.
                              </button>
                            )}
                            <button onClick={() => handleDelete(article.id)} className={css.deleteBtn}>
                              Удал.
                            </button>
                            {article.status === 'published' && (
                              <a 
                                href={`/blog/${article.slug}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={css.viewBtn}
                              >
                                Смотреть
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'editor' && (
            <form onSubmit={handleSubmit} className={css.editorForm}>
              <div className={css.formGrid}>
                <div className={css.mainColumn}>
                  <div className={css.formGroup}>
                    <label>Заголовок (RU) *</label>
                    <input
                      type="text"
                      value={formData.title_ru}
                      onChange={handleTitleChange}
                      placeholder="Ремонт виллы за 1 млн дирхам"
                      required
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>Заголовок (EN)</label>
                    <input
                      type="text"
                      value={formData.title_en}
                      onChange={(e) => handleChange('title_en', e.target.value)}
                      placeholder="Villa Renovation for 1M AED"
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>URL (slug)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleChange('slug', e.target.value)}
                      placeholder="remont-villy-za-1-mln"
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>Краткое описание (RU) *</label>
                    <textarea
                      value={formData.description_ru}
                      onChange={(e) => handleChange('description_ru', e.target.value)}
                      placeholder="Полный ремонт виллы в Dubai Hills: от дизайн-проекта до сдачи под ключ"
                      rows={3}
                      required
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>
                      Контент статьи (RU) — HTML
                      <div className={css.toolbar}>
                        <button type="button" onClick={() => insertFormatting('h2')}>H2</button>
                        <button type="button" onClick={() => insertFormatting('h3')}>H3</button>
                        <button type="button" onClick={() => insertFormatting('p')}>P</button>
                        <button type="button" onClick={() => insertFormatting('strong')}>B</button>
                        <button type="button" onClick={() => insertFormatting('img')}>Фото</button>
                        <button type="button" onClick={() => insertFormatting('gallery')}>Галерея</button>
                        <button type="button" onClick={() => insertFormatting('blockquote')}>Цитата</button>
                        <button type="button" onClick={() => insertFormatting('ul')}>Список</button>
                        <button type="button" onClick={() => insertFormatting('table')}>Таблица</button>
                      </div>
                    </label>
                    <textarea
                      ref={contentRef}
                      value={formData.content_ru}
                      onChange={(e) => handleChange('content_ru', e.target.value)}
                      placeholder="<h2>О проекте</h2>&#10;<p>Описание проекта...</p>"
                      rows={20}
                      className={css.contentTextarea}
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>Галерея изображений</label>
                    <div className={css.galleryGrid}>
                      {formData.gallery.map((url, index) => (
                        <div key={index} className={css.galleryItem}>
                          <img src={url} alt={`Фото ${index + 1}`} />
                          <button 
                            type="button" 
                            onClick={() => removeGalleryImage(index)}
                            className={css.removeGalleryBtn}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addGalleryImage}
                        className={css.addGalleryBtn}
                      >
                        + Добавить фото
                      </button>
                    </div>
                    <small>Вставьте URL изображений (imgbb.com, imgur.com, или другой хостинг)</small>
                  </div>
                </div>

                <div className={css.sideColumn}>
                  <div className={css.formGroup}>
                    <label>Категория</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => handleChange('category_id', e.target.value)}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={css.formGroup}>
                    <label>Обложка (URL изображения)</label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => handleChange('image', e.target.value)}
                      placeholder="https://i.ibb.co/..."
                    />
                    {formData.image && (
                      <img src={formData.image} alt="Preview" className={css.coverPreview} />
                    )}
                  </div>

                  <div className={css.formGroup}>
                    <label>Время чтения (мин)</label>
                    <input
                      type="number"
                      value={formData.read_time}
                      onChange={(e) => handleChange('read_time', parseInt(e.target.value) || 5)}
                      min={1}
                      max={60}
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>Автор (имя)</label>
                    <input
                      type="text"
                      value={formData.author_name}
                      onChange={(e) => handleChange('author_name', e.target.value)}
                      placeholder="Алексей М."
                    />
                  </div>

                  <div className={css.formGroup}>
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.featured}
                        onChange={(e) => handleChange('featured', e.target.checked)}
                      />
                      {' '}Показать на главной
                    </label>
                  </div>

                  <div className={css.formGroup}>
                    <label>Статус</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                    >
                      <option value="draft">Черновик</option>
                      <option value="published">Опубликовано</option>
                    </select>
                  </div>

                  <div className={css.formActions}>
                    <button 
                      type="submit" 
                      className={css.saveButton}
                      disabled={saveStatus === 'saving'}
                    >
                      {saveStatus === 'saving' ? 'Сохранение...' : 
                       saveStatus === 'saved' ? '✓ Сохранено!' :
                       editingArticle ? 'Сохранить изменения' : 'Создать статью'}
                    </button>
                    {editingArticle && (
                      <button 
                        type="button" 
                        onClick={resetForm}
                        className={css.cancelButton}
                      >
                        Отмена
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BlogAdminPage;
