import React, { useMemo } from 'react';

import { useIntl } from '../../util/reactIntl';
import PageBuilder from '../PageBuilder/PageBuilder';
import SectionTeam from './SectionTeam';

const aboutIntroRu = `
# О нас — YouDu

**YouDu** (рус. Твой Дубай) — маркетплейс услуг от русскоговорящих специалистов в ОАЭ. Клиенты публикуют задания, а специалисты и компании откликаются с предложениями. Мы ускоряем выбор проверенных специалистов, обеспечиваем прозрачное общение и повышаем доверие за счёт верификации и честных отзывов.

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
`;

const aboutClosingRu = `
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

const aboutIntroEn = `
# About YouDu

**YouDu** (“Your Dubai”) is a marketplace of services from Russian-speaking specialists in the UAE. Clients post jobs, and specialists and companies respond with their offers. We shorten the search for vetted providers, keep communication transparent, and build trust through verification badges and authentic reviews.

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
`;

const aboutClosingEn = `
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

const TEAM_PHOTO_BASE = '/static/about/team';
const TEAM_PHOTO_ABSOLUTE = 'https://youdu.ae/static/about/team';

const getTeamMembers = isRu => [
  {
    id: 'aleksandr-gross',
    name: isRu ? 'Александр Гросс' : 'Aleksandr Gross',
    role: isRu ? 'Основатель' : 'Founder',
    bio: isRu
      ? 'Основатель и идейный вдохновитель YouDu («Твой Дубай») — цифровой платформы для русскоязычных заказчиков и специалистов в ОАЭ. Миссия проекта — помогать соотечественникам находить работу и надёжных исполнителей, поддерживая доверие через прозрачные профили и честные отзывы о качестве услуг.'
      : 'Founder and visionary behind YouDu (“Your Dubai”) — a digital platform for Russian-speaking clients and specialists in the UAE. The project helps compatriots find work and reliable providers, building trust through transparent profiles and honest reviews of service quality.',
    photo: `${TEAM_PHOTO_BASE}/aleksandr-gross.jpg`,
    photoAbsolute: `${TEAM_PHOTO_ABSOLUTE}/aleksandr-gross.jpg`,
    photoAlt: isRu ? 'Александр Гросс, основатель YouDu' : 'Aleksandr Gross, founder of YouDu',
    linkedin: 'https://www.linkedin.com/in/aleksandr-gross-aa2155383',
  },
  {
    id: 'yulia-shen',
    name: isRu ? 'Юлия Шен' : 'Yulia Shen',
    role: isRu
      ? 'Проектный менеджер по привлечению пользователей'
      : 'User Acquisition Project Manager',
    bio: isRu
      ? 'Отвечает за рост пользовательской базы YouDu и развитие сообщества платформы. Работает над привлечением клиентов и специалистов, создавая условия для устойчивого развития маркетплейса.'
      : 'Responsible for growing YouDu’s user base and developing the platform community. Attracts clients and specialists, creating conditions for sustainable marketplace growth.',
    photo: `${TEAM_PHOTO_BASE}/yulia-shen.jpg`,
    photoAbsolute: `${TEAM_PHOTO_ABSOLUTE}/yulia-shen.jpg`,
    photoAlt: isRu
      ? 'Юлия Шен, проектный менеджер YouDu'
      : 'Yulia Shen, user acquisition project manager at YouDu',
    linkedin: null,
  },
  {
    id: 'ruslan-yakubov',
    name: isRu ? 'Руслан Якубов' : 'Ruslan Yakubov',
    role: isRu
      ? 'Специалист по верификации пользователей YouDu'
      : 'User Verification Specialist',
    bio: isRu
      ? 'Проводит проверку специалистов, компаний и документов, подтверждая достоверность предоставленной информации. Выполняет выездные проверки, собирает необходимые материалы и оформляет результаты платной верификации.'
      : 'Verifies specialists, companies, and documents, confirming the authenticity of submitted information. Conducts on-site checks, collects required materials, and prepares the results of paid verification.',
    photo: `${TEAM_PHOTO_BASE}/ruslan-yakubov.jpg`,
    photoAbsolute: `${TEAM_PHOTO_ABSOLUTE}/ruslan-yakubov.jpg`,
    photoAlt: isRu
      ? 'Руслан Якубов, специалист по верификации YouDu'
      : 'Ruslan Yakubov, user verification specialist at YouDu',
    linkedin: null,
  },
];

const buildAboutPage = locale => {
  const isRu = locale?.toLowerCase().startsWith('ru');
  const intro = isRu ? aboutIntroRu : aboutIntroEn;
  const closing = isRu ? aboutClosingRu : aboutClosingEn;
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
            blockId: 'about-intro-content',
            text: {
              fieldType: 'markdown',
              content: intro,
            },
          },
        ],
      },
      {
        sectionType: 'team',
        sectionId: 'about-team',
        appearance: { fieldType: 'customAppearance', backgroundColor: '#ffffff' },
        title: isRu ? 'Команда YouDu' : 'Our Team',
        description: isRu
          ? 'Мы объединяем экспертизу в сервисном бизнесе, продуктовом IT и локальных операциях в Дубае.'
          : 'We combine expertise in service businesses, product engineering, and hands-on operations in Dubai.',
        members: getTeamMembers(isRu),
      },
      {
        sectionType: 'article',
        sectionId: 'about-closing',
        appearance: { fieldType: 'customAppearance', backgroundColor: '#ffffff' },
        blocks: [
          {
            blockType: 'defaultBlock',
            blockId: 'about-closing-content',
            text: {
              fieldType: 'markdown',
              content: closing,
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

const aboutPageOptions = {
  sectionComponents: {
    team: { component: SectionTeam },
  },
};

const AboutPage = () => {
  const intl = useIntl();
  const locale = intl?.locale || 'en';
  const pageData = useMemo(() => buildAboutPage(locale), [locale]);

  return (
    <PageBuilder
      pageAssetsData={pageData}
      schemaType="AboutPage"
      inProgress={false}
      options={aboutPageOptions}
    />
  );
};

export default AboutPage;
