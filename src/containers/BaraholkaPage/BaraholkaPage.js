import React from 'react';
import { Helmet } from 'react-helmet-async';

import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './BaraholkaPage.module.css';

const SEO_TITLE = 'Барахолка Дубай — объявления, купить и продать б/у | YouDu';
const SEO_DESCRIPTION =
  'Где в Дубае покупать и продавать вещи с рук: барахолки в Telegram, Dubizzle, Facebook Marketplace. Как выбрать площадку, как не попасть на мошенников, где отдать вещи даром.';
const SEO_KEYWORDS =
  'барахолка дубай, объявления дубай, доска объявлений дубай, аналог авито в дубае, купить бу дубай, продать вещи дубай, отдам даром дубай, барахолка телеграм дубай, бу мебель дубай';
const CANONICAL_URL = 'https://youdu.ae/baraholka-dubai';

const TELEGRAM_GROUPS = [
  {
    name: 'Барахолка Дубай',
    handle: '@baraholkadubae',
    url: 'https://t.me/baraholkadubae',
    members: '25 000+',
    description:
      'Крупнейшая русскоязычная барахолка в Дубае. Мебель, техника, электроника, одежда, детские товары. Без комиссии и посредников.',
  },
  {
    name: 'Барахолка Дубай',
    handle: '@dubaibaraholka',
    url: 'https://t.me/dubaibaraholka',
    members: '6 000+',
    description:
      'Группа частных объявлений. Мебель, техника, детские вещи, рубрика «отдам даром». Участники из Дубая, Абу-Даби и Шарджи.',
  },
];

const PLATFORMS = [
  {
    name: 'Барахолки в Telegram',
    good: [
      'Только частные продавцы, без магазинов и перекупщиков',
      'Не нужна регистрация — достаточно аккаунта в Telegram',
      'Договориться можно за минуты, прямо в чате',
      'Русскоязычная аудитория, никаких языковых сложностей',
    ],
    bad: [
      'Нет поиска по архиву: объявление живёт час-два и тонет в ленте',
      'Никто не проверяет ни товар, ни продавца',
    ],
    who: 'Мебель, техника, детские вещи, одежда, всё при переездах',
  },
  {
    name: 'Dubizzle',
    good: [
      'Самая большая доска объявлений в ОАЭ',
      'Нормальный поиск с фильтрами по цене, району и состоянию',
      'Объявление не пропадает через час',
    ],
    bad: [
      'Много профессиональных продавцов и агентств вперемешку с частными',
      'Интерфейс и объявления на английском',
    ],
    who: 'Крупные покупки, когда важно сравнить несколько вариантов',
  },
  {
    name: 'Facebook Marketplace',
    good: [
      'Много мебели и техники от уезжающих экспатов',
      'Виден профиль продавца, а не безымянный аккаунт',
    ],
    bad: ['Нужен активный аккаунт в Facebook', 'Много мошеннических объявлений, модерация слабая'],
    who: 'Мебель и бытовая техника целыми комплектами',
  },
  {
    name: 'Чаты жилых комплексов',
    good: [
      'Продавец — сосед из вашей же башни, вещь можно донести руками',
      'Больше всего предложений «отдам даром»',
    ],
    bad: ['Закрытые: попасть можно, только если вы живёте в этом комплексе'],
    who: 'Мелочь для дома, детские вещи, растения, всё крупногабаритное',
  },
];

const SAFETY_RULES = [
  {
    title: 'Встречайтесь лично',
    text:
      'Торговые центры, вестибюли станций метро, лобби башен с охраной. Все эти места под камерами. Если продавец в принципе не готов встретиться — это уже ответ.',
  },
  {
    title: 'Деньги — после вещи',
    text:
      'Наличные дирхамы в момент передачи. Никакой предоплаты за «бронь», «резерв» или «доставку», как бы убедительно ни звучала причина.',
  },
  {
    title: 'Не диктуйте коды из СМС',
    text:
      'Ни один банк не спрашивает код, чтобы зачислить вам деньги. Код нужен только для списания. Просьба продиктовать его — это всегда попытка обмана.',
  },
  {
    title: 'Проверяйте скриншот перевода',
    text:
      'Картинка с успешным платежом рисуется за минуту. Смотрите поступление в своём приложении банка, а не на экране собеседника.',
  },
  {
    title: 'iPhone — только с отвязанным iCloud',
    text:
      'Привязанный к чужому Apple ID телефон превращается в кирпич. Проверьте настройки при продавце и сверьте IMEI по коду *#06#.',
  },
];

const FAQ = [
  {
    q: 'Есть ли аналог Авито в Дубае?',
    a:
      'Прямого аналога нет: роль Авито в ОАЭ поделена между несколькими площадками. Ближе всего по функциям Dubizzle — крупнейшая доска объявлений страны с поиском и фильтрами. По духу ближе барахолки в Telegram: только частные продавцы, без регистрации и комиссии. Русскоязычные жители обычно пользуются и тем, и другим.',
  },
  {
    q: 'Где в Дубае купить б/у мебель?',
    a:
      'Основные источники — барахолки в Telegram, Dubizzle и Facebook Marketplace. Больше всего предложений появляется в конце учебного года и перед летом, когда экспаты уезжают из страны и распродают обстановку целыми квартирами. Отдельно стоит смотреть чаты своего жилого комплекса: там мебель часто отдают даром, потому что вывозить её дороже.',
  },
  {
    q: 'Что такое барахолка в Telegram?',
    a:
      'Это групповой чат, куда участники выкладывают объявления о продаже личных вещей. Площадка не берёт комиссию, не хранит деньги и не выступает гарантом: покупатель и продавец договариваются напрямую. Регистрация не нужна, достаточно аккаунта в Telegram.',
  },
  {
    q: 'Как отдать вещи даром в Дубае?',
    a:
      'Проще всего опубликовать объявление с пометкой «отдам даром» в барахолке или в чате своего жилого комплекса. Вещи разбирают за считанные часы, особенно детские и мебель. Если вещей много и они крупные, дешевле нанять машину на вывоз, чем разбираться с каждым желающим по отдельности.',
  },
  {
    q: 'Безопасно ли покупать с рук в ОАЭ?',
    a:
      'Да, если сделка идёт лично и деньги передаются вместе с вещью. Почти все случаи обмана начинаются там, где товар и оплата разнесены во времени: предоплата курьеру, ссылка на оплату, просьба продиктовать код из СМС. Если деньги всё-таки ушли, заявление подаётся онлайн через платформу Dubai Police eCrime.',
  },
  {
    q: 'Нужна ли регистрация, чтобы продать вещь?',
    a:
      'На барахолках в Telegram — нет, нужен только аккаунт в Telegram. На Dubizzle и Facebook Marketplace регистрация обязательна. Комиссию с частных объявлений не берёт ни одна из этих площадок.',
  },
];

const SERVICES = [
  {
    title: 'Перевезти покупку',
    text: 'Шкаф, диван, холодильник — своими силами такое не увезти',
    categoryId: 'Cargo_transportation',
    sub: 'Moving',
  },
  {
    title: 'Вывезти ненужное',
    text: 'То, что не разобрали даром, надо куда-то деть',
    categoryId: 'Cargo_transportation',
    sub: 'Garbage_removal',
  },
  {
    title: 'Собрать мебель',
    text: 'Купленное с рук обычно приезжает в разобранном виде',
    categoryId: 'repairs_main',
    sub: 'Carpenter',
  },
  {
    title: 'Подключить технику',
    text: 'Стиральная машина, посудомойка, плита после покупки',
    categoryId: 'Installation_mashines',
    sub: null,
  },
  {
    title: 'Забрать и привезти',
    text: 'Продавец в другом эмирате, а ехать некогда',
    categoryId: 'Delivery',
    sub: 'buy_delivery',
  },
];

const BaraholkaPage = () => {
  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: SEO_TITLE,
    description: SEO_DESCRIPTION,
    url: CANONICAL_URL,
    inLanguage: 'ru',
    about: {
      '@type': 'Thing',
      name: 'Барахолка и объявления в Дубае',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://youdu.ae' },
        { '@type': 'ListItem', position: 2, name: 'Барахолка Дубай', item: CANONICAL_URL },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <Page
      title={SEO_TITLE}
      description={SEO_DESCRIPTION}
      scrollingDisabled={false}
      schema={pageSchema}
    >
      <Helmet>
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.root}>
          <header className={css.hero}>
            <h1 className={css.title}>Барахолка Дубай: где покупать и продавать вещи с рук</h1>
            <p className={css.lead}>
              В ОАЭ нет одного большого сайта объявлений, к которому все привыкли дома. Вместо него
              — несколько площадок, и на каждой свои правила. Ниже разбор, где что искать, как
              выглядит нормальная сделка и по каким признакам видно мошенника.
            </p>
          </header>

          <section className={css.groupsSection}>
            <h2 className={css.groupsSectionTitle}>Наши барахолки в Telegram</h2>
            <p className={css.groupsSectionLead}>
              Две крупнейшие русскоязычные группы частных объявлений в Дубае. Вместе — больше 30 000
              участников. Без комиссии и посредников.
            </p>
            <div className={css.groupsGrid}>
              {TELEGRAM_GROUPS.map(group => (
                <div className={css.groupCard} key={group.handle}>
                  <div className={css.groupHeader}>
                    <span className={css.groupName}>{group.name}</span>
                    <span className={css.groupMembers}>{group.members} участников</span>
                  </div>
                  <p className={css.groupHandle}>{group.handle}</p>
                  <p className={css.groupText}>{group.description}</p>
                  <a
                    className={css.groupButton}
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть группу
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>Где искать объявления в Дубае</h2>
            <div className={css.platforms}>
              {PLATFORMS.map(platform => (
                <article className={css.platform} key={platform.name}>
                  <h3 className={css.platformName}>{platform.name}</h3>
                  <p className={css.platformWho}>{platform.who}</p>
                  <ul className={css.pros}>
                    {platform.good.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <ul className={css.cons}>
                    {platform.bad.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>Как не потерять деньги на сделке</h2>
            <p className={css.sectionLead}>
              Ни одна из площадок не держит деньги и не проверяет товар, поэтому безопасность сделки
              целиком на покупателе и продавце. Пять правил закрывают почти все известные схемы
              обмана.
            </p>
            <ol className={css.rules}>
              {SAFETY_RULES.map(rule => (
                <li className={css.rule} key={rule.title}>
                  <h3 className={css.ruleTitle}>{rule.title}</h3>
                  <p className={css.ruleText}>{rule.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>Частые вопросы</h2>
            <div className={css.faq}>
              {FAQ.map(item => (
                <details className={css.faqItem} key={item.q}>
                  <summary className={css.faqQuestion}>{item.q}</summary>
                  <p className={css.faqAnswer}>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <h2 className={css.sectionTitle}>Когда нужен человек, а не вещь</h2>
            <p className={css.sectionLead}>
              Купить шкаф — половина дела: его ещё надо привезти и собрать. Такие задачи закрывают
              частные мастера на YouDu: с отзывами, проверкой документов и ценой, которую вы
              обсуждаете напрямую.
            </p>
            <div className={css.services}>
              {SERVICES.map(service => (
                <NamedLink
                  className={css.service}
                  key={service.title}
                  name="CategoryExecutorsPage"
                  params={{ categoryId: service.categoryId }}
                  to={service.sub ? { search: `?sub=${service.sub}` } : undefined}
                >
                  <span className={css.serviceTitle}>{service.title}</span>
                  <span className={css.serviceText}>{service.text}</span>
                </NamedLink>
              ))}
            </div>
          </section>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BaraholkaPage;
