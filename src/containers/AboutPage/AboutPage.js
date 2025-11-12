import React, { useMemo } from 'react';

import { useIntl } from '../../util/reactIntl';
import PageBuilder from '../PageBuilder/PageBuilder';

const aboutContentRu = `
# О нас — YouDu

**YouDu** — маркетплейс услуг в Дубае и ОАЭ. Клиенты публикуют задания, а исполнители-конкурсанты откликаются с предложениями. Мы ускоряем выбор проверенных специалистов, обеспечиваем прозрачное общение и повышаем доверие за счёт верификации и честных отзывов.

## Что делает YouDu

- Публикация задания с адресом на карте, бюджетом и фото.
- Получение откликов с собственной ценой и сроками от мастеров.
- Чат для уточнения деталей, обмена файлами и фиксирования договорённостей.
- Рейтинг и отзывы после завершения работы.
- Верификация профиля (бейдж \`Verified\`) — доверие и приоритетное отображение в выдаче.

Мы — технологическая платформа. YouDu не является стороной договора между клиентом и исполнителем, но задаёт правила, модерацию и защищает сделку механизмами доверия.

**География:** Дубай и другие эмираты ОАЭ.  
**Языки интерфейса:** RU / EN (добавляем новые по мере роста).  
**Контакты:** support@youdu.ae · info@youdu.ae

---

## Наши цели

**Миссия:** сделать заказ бытовых и профессиональных услуг в ОАЭ быстрым, прозрачным и безопасным для обеих сторон.

### 1. Качество и доверие
- ≥80% откликов — от верифицированных мастеров.
- ≤12 часов — среднее время от публикации до выбора исполнителя.

### 2. Удобство и скорость
- ≤2 минут на публикацию задания благодаря умному UI и авто-подсказкам.
- ≥30% конверсия «регистрация мастера → первый отклик».

### 3. Безопасность и честность
- Антифрод-фильтры против самозаказов и накруток отзывов.
- 100% спорных кейсов проходят модерацию с документальным подтверждением.

### 4. Локальность
- Точный геопоиск и выдача мастеров «рядом».
- Локальные категории: ремонт, электрика, сантехника, клининг и др.

Наши ценности: прозрачность, надёжность, локальная экспертиза, скорость, уважение к данным пользователей.

---

## Команда YouDu

Мы объединяем экспертизу в сервисном бизнесе, продуктовом IT и локальных операциях в Дубае. Комбинируем инженерное мышление, понятный UI и модели доверия: верификация, рейтинг, прозрачный чат.

---

### Коротко

**Elevator pitch**  
YouDu — маркетплейс услуг в ОАЭ: клиент публикует задание, мастера конкурируют предложениями. Верификация и отзывы ускоряют выбор исполнителя.

**Почему YouDu**
- Приоритет для Verified-исполнителей — больше заказов лучшим мастерам.
- Реальная локальность — задания рядом без лишних поездок.
- Прозрачный чат и понятный бюджет.
- Антифрод и модерация — защита от фейков.

**Как это работает (3 шага)**
1. Клиент публикует задание с бюджетом и адресом.
2. Мастера откликаются и предлагают цену.
3. Клиент выбирает исполнителя → работа → реальный отзыв.
`;

const aboutContentEn = `
# About YouDu

**YouDu** is a services marketplace covering Dubai and the wider UAE. Clients post jobs and specialists respond with their offers. We shorten the search for vetted providers, keep communication transparent, and build trust through verification badges and authentic reviews.

## What YouDu Delivers

- Job posts with map location, budget, and photos.
- Bids from specialists with their own pricing and timelines.
- In-product chat to clarify scope, share files, and keep agreements traceable.
- Ratings and reviews once the work is done.
- Profile verification (\`Verified\`) that unlocks higher trust and priority exposure.

We are a technology platform, not a direct party to the contract between client and provider. YouDu sets the rules, moderates content, and safeguards the transaction with trust mechanisms.

**Where we operate:** Dubai and other Emirates in the UAE.  
**Interface languages:** RU / EN (more coming as we grow).  
**Contacts:** support@youdu.ae · info@youdu.ae

---

## Our Goals

**Mission:** make booking household and professional services in the UAE fast, transparent, and safe for both sides.

### 1. Quality & Trust
- ≥80% of bids from verified specialists.
- ≤12 hours average from job posting to contractor selection.

### 2. Convenience & Speed
- ≤2 minutes to publish a job thanks to smart UI and auto-suggestions.
- ≥30% conversion from specialist signup to first bid.

### 3. Safety & Fairness
- Anti-fraud filters against self-bidding and review manipulation.
- 100% of disputes handled via moderation with documented proof.

### 4. Local Focus
- Accurate geo-matching and “nearby” specialist suggestions.
- Local categories: renovation, electrical, plumbing, cleaning, and more.

Our values: transparency, reliability, local expertise, speed, and respect for user data.

---

## Who We Are

Our team combines experience in service businesses, product engineering, and hands-on operations in Dubai. We blend engineering mindset, intuitive UI, and trust models—verification, ratings, transparent chat.

---

### At a Glance

**Elevator pitch**  
YouDu is the UAE services marketplace where clients post a job and specialists compete with offers. Verification and reviews accelerate confident hiring.

**Why YouDu**
- Verified specialists get priority and more jobs.
- Real locality — jobs near you without unnecessary travel.
- Transparent chat and clear budgeting.
- Anti-fraud controls and human moderation to keep the platform clean.

**How it works (3 steps)**
1. A client posts a job with budget and location.
2. Specialists reply with their proposal and price.
3. The client selects a provider → work is delivered → genuine review.
`;

const buildAboutPage = locale => {
  const isRu = locale?.toLowerCase().startsWith('ru');
  const content = isRu ? aboutContentRu : aboutContentEn;
  const meta = isRu
    ? {
        title: 'О нас — YouDu',
        description:
          'YouDu — маркетплейс услуг в ОАЭ: публикация заданий, отклики Verified-мастеров и прозрачный чат для безопасного сотрудничества.',
      }
    : {
        title: 'About YouDu',
        description:
          'YouDu is the UAE services marketplace that connects clients with verified specialists through transparent bids, chat, and reviews.',
      };

  return {
    sections: [
      {
        sectionType: 'article',
        sectionId: 'about-intro',
        appearance: { fieldType: 'customAppearance', backgroundColor: '#ffffff' },
        blocks: [
          {
            blockType: 'defaultBlock',
            blockId: 'about-content',
            text: {
              fieldType: 'markdown',
              content,
            },
          },
        ],
      },
    ],
    meta: {
      pageTitle: {
        fieldType: 'metaTitle',
        content: meta.title,
      },
      pageDescription: {
        fieldType: 'metaDescription',
        content: meta.description,
      },
      socialSharing: {
        fieldType: 'openGraph',
        title: meta.title,
        description: meta.description,
      },
    },
  };
};

const AboutPage = () => {
  const intl = useIntl();
  const locale = intl?.locale || 'en';
  const pageData = useMemo(() => buildAboutPage(locale), [locale]);

  return <PageBuilder pageAssetsData={pageData} schemaType="Article" inProgress={false} />;
};

export default AboutPage;
