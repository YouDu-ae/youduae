import React from 'react';
import loadable from '@loadable/component';
import { useIntl } from '../../util/reactIntl';


const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

const fallbackPrivacyPolicyRu = `
# Политика обработки и защиты информации

**Последнее обновление:** 28 октября 2026 года

**Контролёр:** Aleksandr Gross, действующий как индивидуальный оператор платформы «YouDu.ae» (MVP-версия).

**Контакты по приватности:** info@youdu.ae  
United Arab Emirates.

---

## 1. Какие данные мы обрабатываем

- **Аккаунт:** имя/никнейм, e-mail, телефон.
- **Данные заданий и откликов:** заголовок, описание, категория, район/адрес (при необходимости), бюджет, фото.
- **Профиль специалиста:** районы работы, языки общения, минимальная стоимость работ, когда вы работаете — если вы их укажете.
- **История действий на площадке:** когда создано или изменено задание, отправлен или принят отклик, пройден этап сделки, отправлено сообщение, оставлен отзыв, изменён профиль — с датой и прежним значением.
- **Голос** — только если вы пользуетесь голосовым помощником (раздел «Голосовой помощник»).
- **Техданные:** IP, User-Agent, события интерфейса, strictly-necessary cookies. (Маркетинговые/аналитические cookies — только при вашем согласии.)

---

## 2. Цели и правовые основания

- **Регистрация и аутентификация, публикация заданий/откликов, обмен сообщениями** — исполнение договора.
- **Поддержка, безопасность, предотвращение злоупотреблений** — законные требования PDPL/безопасность.
- **Верификация (KYC), рассылки, нестрого-необходимые cookies/аналитика** — по вашему согласию, которое можно отозвать в любой момент.
- **Рейтинг и рекомендации специалистов с помощью ИИ** — по отдельному согласию специалиста (раздел «Рейтинг и рекомендации специалистов»).
- **Голосовой помощник** — по вашему явному согласию (раздел «Голосовой помощник»).

---

## 3. Передача и обработчики

Мы используем подрядчиков (хостинг, e-mail/OTP, распознавание речи для голосового помощника — OpenAI, анти-фрод/KYC при включении). Они обрабатывают данные по нашим инструкциям и только в нужных целях. Список ключевых обработчиков доступен по запросу.

---

## 4. Международная передача

Данные могут обрабатываться за пределами ОАЭ. Передачу осуществляем при наличии адекватности/договорных гарантий/согласия или иной применимой основы, предусмотренной PDPL.

---

## 5. Срок хранения

Храним данные столько, сколько необходимо для функционирования сервиса и правовых целей, затем удаляем/анонимизируем. Аккаунт, задания, переписку, отзывы и историю действий храним, пока существует аккаунт.

**История действий.** Платформа Sharetribe, на которой работает YouDu, хранит журнал изменений только 90 дней. Поэтому мы сохраняем его копию и копию заданий и сделок в собственной базе данных YouDu (серверы Heroku в ЕС), чтобы история сделок не пропадала, чтобы разбирать споры и считать показатели специалистов: сколько заданий выполнено, отзывы, скорость ответа, районы и категории работ. Статистику цен и сроков по категориям и районам мы используем только в обобщённом виде. Копия доступна только YouDu. Если мы подключим AI-помощника, ему будут доступны только публичные данные профилей, опубликованные задания и обобщённые показатели — без переписки, контактов и точного адреса; действия от вашего имени — только с вашего подтверждения.

При удалении аккаунта мы удаляем из этой копии все записи, где вы упоминаетесь. В резервных копиях базы они остаются не дольше 14 дней, пока копии не перезапишутся.

---

## Рейтинг и рекомендации специалистов

YouDu может с помощью искусственного интеллекта упорядочивать специалистов и рекомендовать заказчику тех, кто лучше подходит под его задание.

- **На чём основана рекомендация:** только на работе на площадке — категории и районы, выполненные задания и выборы исполнителем, оценки и отзывы, скорость ответа, цены относительно типичных в категории, заполненность профиля и верификация, жалобы и нарушения правил.
- **Что мы никогда не используем:** национальность, пол, возраст, религию, здоровье и другие чувствительные данные, а также содержание личной переписки.
- **Решение за человеком:** рекомендация — подсказка заказчику. Исполнителя выбирает заказчик, ИИ никого не назначает сам. Специалист без рекомендации остаётся в общем списке и может откликаться на задания.
- **Оплата не влияет на рекомендации.** Если появится платное продвижение, такие профили будут помечены как реклама.
- **Согласие:** профиль специалиста участвует в рекомендациях, только если специалист дал на это отдельное согласие — при регистрации или в настройках профиля. Отозвать его можно там же в любой момент или написав на info@youdu.ae; отклики и сделки после отзыва работают как прежде.
- **Ваши права:** узнать, какие показатели учитываются, исправить данные профиля, возразить против автоматизированной обработки и попросить, чтобы рекомендацию проверил сотрудник YouDu.

---

## Голосовой помощник

Голосовой помощник позволяет рассказать о задании голосом, а не заполнять форму. Он доступен вошедшим пользователям на сайте youdu.ae и в приложении YouDu. Пользоваться им необязательно: задание всегда можно заполнить вручную.

- **Что обрабатывается:** ваш голос во время разговора, его расшифровка и то, что вы говорите о задании: что нужно сделать, адрес, срок, бюджет.
- **Кто обрабатывает:** распознавание речи и ответы помощника обеспечивает OpenAI, L.L.C. (США). Звук идёт напрямую между вашим устройством и OpenAI, сервер YouDu его не получает. Названный вами адрес мы уточняем через Google Maps Platform (Google LLC).
- **Как OpenAI использует данные:** по условиям OpenAI для API такие данные по умолчанию не используются для обучения моделей. OpenAI может хранить их до 30 дней для контроля злоупотреблений, если закон не требует хранить дольше.
- **Что хранит YouDu:** запись и текст разговора мы не храним. О каждом разговоре сохраняется служебная запись: когда он начался, подготовлен ли черновик и какие поля заполнил помощник — без их содержимого. Она нужна, чтобы ограничивать число разговоров в сутки и следить за работой функции. Ещё мы храним, когда вы дали согласие и когда отозвали его. Эти записи удаляются вместе с аккаунтом.
- **Черновик, а не публикация:** помощник только заполняет поля задания, дальше с ними всё так же, как при ручном заполнении. Опубликовать задание можете только вы, проверив поля: помощник может ошибиться в адресе, сроке или бюджете.
- **Согласие:** перед первым разговором мы спрашиваем ваше явное согласие на передачу данных в OpenAI. Отозвать его можно в любой момент — кнопкой «Отозвать согласие» в окне помощника на сайте или написав на info@youdu.ae. Отзыв не затрагивает уже состоявшиеся разговоры.
- **Не сообщайте лишнего:** не называйте помощнику данные банковских карт, паспорта, сведения о здоровье и другие чувствительные данные — для задания они не нужны.

---

## 6. Безопасность

Применяем меры: шифрование в транзите (HTTPS), ограничение доступа, журналы событий, резервное копирование. При инциденте уведомим вас и регулятора, если это требуется PDPL.

---

## 7. Ваши права

Вы вправе запросить доступ, копию, переносимость, исправление, удаление, ограничение/остановку обработки, а также возразить против решений, основанных на автоматизированной обработке. Запросы — на info@youdu.ae.

---

## 8. Дети

Сервис для пользователей 18+. Если данные ребёнка были предоставлены без согласия законного представителя, свяжитесь с нами — мы удалим их.

---

## 9. Cookies

Мы используем строго необходимые cookies для работы сайта (сессии, выбор языка, сохранение согласия). Аналитические и маркетинговые cookies загружаются только при вашем согласии через баннер настроек cookie. Вы можете изменить выбор в любой момент по ссылке «Cookie settings» в футере или в настройках браузера. Для подробностей см. ниже раздел «Аналитика (Plausible, без cookie)».

---

## 10. Аналитика (Plausible, без cookie)

Мы измеряем посещаемость через Plausible Analytics — privacy-first сервис без использования cookies и без персональных данных. Собираются только агрегированные метрики (просмотры, источники трафика, типы устройств и т. п.). Идентификаторы пользователей не создаются и не хранятся. Хостинг аналитических данных — ЕС (Германия, Hetzner), что помогает выполнять требования PDPL к международной передаче и безопасности.

**Приложение YouDu.** В приложении мы тоже считаем статистику через Plausible: какие экраны открываются и как часто создают задания, выбирают исполнителя, отправляют сообщения, завершают задания, оставляют отзывы и пользуются голосовым помощником. Из подробностей к событию добавляется только категория задания, а по техническим данным запроса Plausible определяет тип устройства и версию iOS. Имена, идентификаторы пользователей, тексты сообщений, названия заданий и адреса в статистику не попадают. Plausible не хранит IP-адрес: по нему определяются только страна, регион и город, а метка для подсчёта уникальных посетителей меняется каждые сутки. Рекламы и отслеживания между приложениями и сайтами других компаний в приложении нет.

Мы используем Plausible на основании законного интереса (измерение производительности сервиса) и принципа минимизации PDPL. Если в будущем подключим стороннюю аналитику или маркетинговые пиксели, они загрузятся только при вашем явном согласии через баннер.

---

## 11. Правовая основа и ваш выбор

Строго необходимые cookies обрабатываются как необходимое условие для предоставления сервиса. Plausible — законный интерес с учётом отсутствия cookies и персональных идентификаторов. Любая аналитика/маркетинг, использующая cookies или идентификаторы, активируется только после вашего согласия через баннер, и вы можете отозвать его в любой момент во футере или настройках браузера.

Мы действуем по PDPL ОАЭ: обеспечиваем прозрачность, ограничение целей, минимизацию, безопасность и соблюдение прав субъектов данных.

---

## 12. Изменения и будущая компания

При регистрации юрлица контролёр будет изменён на компанию. Мы обновим эту Политику и уведомим пользователей. Вы вправе удалить аккаунт до вступления изменений в силу.

---

## 13. Контакты

**Вопросы по персональным данным:** info@youdu.ae  
**По спорам:** применимо право ОАЭ.
`;

const fallbackPrivacyPolicyEn = `
# Privacy Policy

**Last updated:** 28 October 2026

**Controller:** Aleksandr Gross, acting as the individual operator of the YouDu.ae platform (MVP version).

**Privacy contact:** info@youdu.ae  
United Arab Emirates.

---

## 1. Data We Process

- **Account:** name/display name, e-mail, phone number.
- **Jobs and offers:** title, description, category, district/address (if required), budget, photos.
- **Specialist profile:** service areas, languages, minimum job price and when you work — if you provide them.
- **Activity history on the platform:** when a task is created or changed, an offer is sent or accepted, a deal moves to a new stage, a message is sent, a review is left or a profile is changed — with the date and the previous value.
- **Voice** — only if you use the voice assistant (see "Voice Assistant").
- **Technical data:** IP, User-Agent, interface events, strictly necessary cookies. (Marketing/analytics cookies are used only with your consent.)

---

## 2. Purposes and Legal Bases

- **Registration and authentication, posting jobs/offers, messaging** — performance of the contract.
- **Support, security, abuse prevention** — legal obligations and legitimate interests under PDPL.
- **Verification (KYC), newsletters, non-essential cookies/analytics** — based on your consent, which you can withdraw at any time.
- **AI ranking and recommendation of specialists** — based on the specialist's separate consent (see "Specialist Ranking and Recommendations").
- **Voice assistant** — based on your explicit consent (see "Voice Assistant").

---

## 3. Sharing and Processors

We use processors (hosting, e-mail/OTP, speech recognition for the voice assistant — OpenAI, anti-fraud/KYC if enabled). They operate under our instructions and only for the intended purposes. A list of key processors is available on request.

---

## 4. International Transfers

Data may be processed outside the UAE. Transfers rely on adequacy decisions, contractual safeguards, consent, or another lawful PDPL basis.

---

## 5. Retention Periods

We retain data as long as necessary for the service and legal purposes, then delete or anonymize it. We keep your account, tasks, messages, reviews and activity history for as long as your account exists.

**Activity history.** Sharetribe, the platform YouDu runs on, keeps its change log for 90 days only. We therefore keep a copy of it, along with a copy of tasks and deals, in YouDu's own database (Heroku servers in the EU), so that deal history is not lost, disputes can be resolved, and specialist track records can be calculated: tasks completed, reviews, response time, areas and categories of work. Price and timing statistics by category and area are used only in aggregate. Only YouDu has access to this copy. If we connect an AI assistant, it will only see public profile data, published tasks and aggregate figures — never messages, contact details or exact addresses — and it will act on your behalf only after you confirm.

When you delete your account, we remove every record in this copy that mentions you. Database backups may keep them for up to 14 days, until the backups are overwritten.

---

## Specialist Ranking and Recommendations

YouDu may use artificial intelligence to rank specialists and recommend to a client those who best fit their task.

- **What a recommendation is based on:** only work on the platform — categories and areas, tasks completed and times chosen, ratings and reviews, response speed, prices compared with typical prices in the category, profile completeness and verification, complaints and rule violations.
- **What we never use:** nationality, gender, age, religion, health or other sensitive data, or the content of private messages.
- **A person decides:** a recommendation is a suggestion to the client. The client chooses the specialist; AI never assigns anyone by itself. A specialist who is not recommended stays in the general list and can still send offers.
- **Payment does not affect recommendations.** If paid promotion is introduced, such profiles will be clearly marked as advertising.
- **Consent:** a specialist's profile takes part in recommendations only with the specialist's separate consent, given at sign-up or in profile settings. It can be withdrawn there at any time or by writing to info@youdu.ae; offers and deals keep working as before.
- **Your rights:** to learn which figures are taken into account, correct profile data, object to automated processing and ask for a recommendation to be reviewed by a member of the YouDu team.

---

## Voice Assistant

The voice assistant lets you describe a task by voice instead of filling in the form. It is available to signed-in users on youdu.ae and in the YouDu app. Using it is optional: you can always fill in the task manually.

- **What is processed:** your voice during the conversation, its transcript and what you say about the task: what needs to be done, the address, the deadline and the budget.
- **Who processes it:** speech recognition and the assistant's replies are provided by OpenAI, L.L.C. (USA). Audio goes directly between your device and OpenAI; YouDu's server does not receive it. We look up the address you name with Google Maps Platform (Google LLC).
- **How OpenAI uses the data:** under OpenAI's API terms, such data is not used to train its models by default. OpenAI may keep it for up to 30 days to monitor abuse, unless the law requires longer.
- **What YouDu keeps:** we do not keep the recording or the transcript. For each conversation we keep a service record: when it started, whether a draft was prepared and which fields the assistant filled in — without their contents. It lets us limit the number of conversations per day and keep an eye on how the feature works. We also keep when you gave consent and when you withdrew it. These records are deleted together with your account.
- **A draft, not a publication:** the assistant only fills in the task fields; from then on they are handled the same way as when you fill them in yourself. Only you can publish the task, after checking the fields: the assistant may get the address, deadline or budget wrong.
- **Consent:** before your first conversation we ask for your explicit consent to send the data to OpenAI. You can withdraw it at any time with the "Withdraw consent" button in the assistant window on the website or by writing to info@youdu.ae. Withdrawal does not affect conversations that have already taken place.
- **Do not share more than needed:** do not tell the assistant bank card details, passport data, health information or other sensitive data — the task does not need them.

---

## 6. Security

We apply measures such as HTTPS encryption, access controls, event logging, and backups. If an incident occurs, we will notify you and the regulator when required by PDPL.

---

## 7. Your Rights

You may request access, copies, portability, rectification, deletion, restriction/stop of processing, and object to automated decisions. Send requests to info@youdu.ae.

---

## 8. Children

The Service is intended for users aged 18+. If a child’s data was provided without guardian consent, contact us and we will delete it.

---

## 9. Cookies

We use strictly necessary cookies for essential functionality (sessions, language, consent storage). Analytics/marketing cookies load only with your consent via the cookie banner. You can change your choice anytime through “Cookie settings” in the footer or via browser settings. See Section 10 below for analytics details.

---

## 10. Analytics (Plausible, Cookie-Free)

We measure traffic with Plausible Analytics — a privacy-first service without cookies or personal data. Only aggregated metrics are collected (page views, traffic sources, device types, etc.). No user identifiers are created or stored. Data is hosted in the EU (Germany, Hetzner), helping us comply with PDPL rules on international transfers and security.

**The YouDu app.** In the app we also use Plausible to count which screens are opened and how often people create tasks, choose a specialist, send messages, complete tasks, leave reviews and use the voice assistant. The only detail added to an event is the task category, and Plausible works out the device type and iOS version from the technical data of the request. Names, user identifiers, message texts, task titles and addresses are not included. Plausible does not store IP addresses: it uses them only to determine the country, region and city, and the label used to count unique visitors changes every day. The app has no advertising and no tracking across other companies' apps and websites.

We rely on legitimate interest (service performance measurement) and PDPL minimization principles. If we add other analytics or marketing pixels in the future, they will load only with your explicit consent through the banner.

---

## 11. Legal Basis and Your Choices

Strictly necessary cookies are processed as required to provide the service. Plausible relies on legitimate interest, given the absence of cookies and personal identifiers. Any analytics/marketing that uses cookies or identifiers will be activated only with your consent, which you can withdraw at any time via the banner or browser settings.

We follow UAE PDPL principles: transparency, purpose limitation, minimization, security, and respect for data-subject rights.

---

## 12. Changes and Future Company Setup

If a legal entity is incorporated, the controller will change to that company. We will update this Policy and notify users. You may delete your account before the changes take effect.

---

## 13. Contact

**Personal data inquiries:** info@youdu.ae  
**Disputes:** governed by UAE law.
`;

// Create fallback content (array of sections) in page asset format:
const metaByLocale = {
  ru: {
    title: 'Политика обработки и защиты информации | YouDu.ae',
    description:
      'Политика конфиденциальности и обработки персональных данных платформы YouDu.ae в соответствии с PDPL ОАЭ',
  },
  en: {
    title: 'Privacy Policy | YouDu.ae',
    description:
      'Privacy Policy for YouDu.ae – how we handle personal data, cookies, and Plausible analytics under UAE PDPL',
  },
};

export const getFallbackSections = locale => {
  const isRu = locale?.toLowerCase().startsWith('ru');
  const content = isRu ? fallbackPrivacyPolicyRu : fallbackPrivacyPolicyEn;
  const meta = isRu ? metaByLocale.ru : metaByLocale.en;

  return {
    sections: [
      {
        sectionType: 'article',
        sectionId: 'privacy',
        appearance: { fieldType: 'customAppearance', backgroundColor: '#ffffff' },
        blocks: [
          {
            blockType: 'defaultBlock',
            blockId: 'hero-content',
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
    },
  };
};

// This is the fallback page, in case there's no Privacy Policy asset defined in Console.
const FallbackPage = props => {
  const intl = useIntl();
  const locale = intl?.locale || 'en';
  return <PageBuilder key={`privacy-${locale}`} pageAssetsData={getFallbackSections(locale)} {...props} />;
};

export default FallbackPage;
