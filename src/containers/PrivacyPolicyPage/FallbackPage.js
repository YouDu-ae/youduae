import React from 'react';
import loadable from '@loadable/component';
import { useIntl } from '../../util/reactIntl';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

const fallbackPrivacyPolicyRu = `
# Политика обработки и защиты информации

**Последнее обновление:** 10 ноября 2025 года

**Контролёр:** Aleksandr Gross, действующий как индивидуальный оператор платформы «YouDu.ae» (MVP-версия).

**Контакты по приватности:** info@youdu.ae  
United Arab Emirates.

---

## 1. Какие данные мы обрабатываем

- **Аккаунт:** имя/никнейм, e-mail, телефон.
- **Данные заданий и откликов:** заголовок, описание, категория, район/адрес (при необходимости), бюджет, фото.
- **Техданные:** IP, User-Agent, события интерфейса, strictly-necessary cookies. (Маркетинговые/аналитические cookies — только при вашем согласии.)

---

## 2. Цели и правовые основания

- **Регистрация и аутентификация, публикация заданий/откликов, обмен сообщениями** — исполнение договора.
- **Поддержка, безопасность, предотвращение злоупотреблений** — законные требования PDPL/безопасность.
- **Верификация (KYC), рассылки, нестрого-необходимые cookies/аналитика** — по вашему согласию, которое можно отозвать в любой момент.

---

## 3. Передача и обработчики

Мы используем подрядчиков (хостинг, e-mail/OTP, анти-фрод/KYC при включении). Они обрабатывают данные по нашим инструкциям и только в нужных целях. Список ключевых обработчиков доступен по запросу.

---

## 4. Международная передача

Данные могут обрабатываться за пределами ОАЭ. Передачу осуществляем при наличии адекватности/договорных гарантий/согласия или иной применимой основы, предусмотренной PDPL.

---

## 5. Срок хранения

Храним данные столько, сколько необходимо для функционирования сервиса и правовых целей, затем удаляем/анонимизируем. Черновики и неактивные аккаунты удаляются после 6 месяцев, переписка — через 1 месяц, логи — 1 неделя.

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

**Last updated:** 10 November 2025

**Controller:** Aleksandr Gross, acting as the individual operator of the YouDu.ae platform (MVP version).

**Privacy contact:** info@youdu.ae  
United Arab Emirates.

---

## 1. Data We Process

- **Account:** name/display name, e-mail, phone number.
- **Jobs and offers:** title, description, category, district/address (if required), budget, photos.
- **Technical data:** IP, User-Agent, interface events, strictly necessary cookies. (Marketing/analytics cookies are used only with your consent.)

---

## 2. Purposes and Legal Bases

- **Registration and authentication, posting jobs/offers, messaging** — performance of the contract.
- **Support, security, abuse prevention** — legal obligations and legitimate interests under PDPL.
- **Verification (KYC), newsletters, non-essential cookies/analytics** — based on your consent, which you can withdraw at any time.

---

## 3. Sharing and Processors

We use processors (hosting, e-mail/OTP, anti-fraud/KYC if enabled). They operate under our instructions and only for the intended purposes. A list of key processors is available on request.

---

## 4. International Transfers

Data may be processed outside the UAE. Transfers rely on adequacy decisions, contractual safeguards, consent, or another lawful PDPL basis.

---

## 5. Retention Periods

We retain data as long as necessary for the service and legal purposes, then delete or anonymize it. Drafts and inactive accounts are removed after 6 months, conversations after 1 month, logs after 1 week.

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
