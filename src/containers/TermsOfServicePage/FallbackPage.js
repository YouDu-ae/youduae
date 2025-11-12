import React from 'react';
import loadable from '@loadable/component';
import { useIntl } from '../../util/reactIntl';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

const fallbackTermsRu = `
# Пользовательское соглашение YouDu.ae

**Последнее обновление:** 4 ноября 2025 г.

**Домен:** youdu.ae (и связанные поддомены/приложения) — далее «Сервис», «Платформа», «Мы».

Нажимая «Зарегистрироваться», «Войти» или используя Сервис, вы («Пользователь») принимаете это Соглашение и Политику обработки и защиты информации (Privacy Policy). Если вы не согласны — не используйте Платформу.

---

## 1. Роли и предмет

**1.1.** Заказчик — пользователь, который публикует задание (заказ на услуги).

**1.2.** Исполнитель (Мастер) — пользователь, который откликается на задание, предлагает цену/условия и выполняет работу.

**1.3.** Предмет: Мы предоставляем онлайн-платформу для публикации заданий, откликов, обмена сообщениями, отзывов и др. Мы не являемся стороной договора между Заказчиком и Исполнителем и не гарантируем результат работ, сроки, качество или оплату.

---

## 2. Регистрация и аккаунт

**2.1.** Использование допускается лицам 18+ с полной дееспособностью.

**2.2.** Вы обязаны предоставить достоверные сведения и поддерживать их актуальность. Один человек — один основной аккаунт. Запрещено передавать доступ третьим лицам.

**2.3.** Мы можем запросить подтверждение e-mail, телефона (SMS-OTP) и/или верификацию личности/компании (KYC). Невыполнение может ограничить функциональность.

---

## 3. Публикация заданий и отклики

**3.1.** Заказчик размещает задание: заголовок, описание, категория, местоположение, бюджет, фото и др.

**3.2.** Исполнитель отправляет отклик с предложением цены/условий. Заказчик вправе выбрать одного из откликнувшихся или никого.

**3.3.** До момента явного выбора Исполнителя и подтверждения условий договор не считается заключённым.

**3.4.** Мы можем скрыть/модерировать задания и отклики, нарушающие правила (см. Раздел 10).

---

## 4. Верификация и уровни доверия

**4.1.** Верификация (опционально): предоставление документов (Emirates ID/паспорт для физлиц; Trade License для компаний) и селфи/адреса по запросу.

**4.2.** Верифицированные аккаунты получают бейдж «Verified» и приоритет показа откликов/профиля в рамках алгоритмов Платформы.

**4.3.** Результат верификации — наше внутреннее решение; при сомнениях мы можем запросить дополнительные сведения или отказать без возврата денежных средств.

---

## 5. Коммуникации и поведение

**5.1.** Чат и «умный UI» используются только для обсуждения задания. Запрещён спам, оскорбления, дискриминация, распространение персональных данных третьих лиц без согласия.

**5.2.** Попытки обойти Платформу для ухода от правил/оплаты платных функций (если активны) могут привести к ограничениям/блокировке.

---

## 6. Оплаты, комиссии и подписки

**6.1.** На этапе MVP публикация заданий и отклики могут быть бесплатными. Мы оставляем за собой право ввести в будущем подписки для мастеров, платные «поднятия», выделение откликов, комиссии и др. с предварительным уведомлением.

**6.2.** Если подключена платёжная система (например, Stripe), правила списаний, возвратов и налогов определяются офертой платёжного провайдера и нашими тарифами.

**6.3.** Налоги и бухгалтерский учёт по оказанным услугам вне Платформы — обязанность соответствующей стороны (Заказчик/Исполнитель). Вы подтверждаете, что соблюдаете применимые требования в ОАЭ.

---

## 7. Отмена, возвраты и споры между пользователями

**7.1.** Условия отмены/возвратов определяются Заказчиком и Исполнителем в их договорённостях. Платформа не является продавцом/исполнителем услуг.

**7.2.** Мы можем предложить неформальную медиaцию, но не обязаны разрешать споры.

**7.3.** В случае жалоб мы вправе временно ограничить аккаунты, скрыть рейтинг/отзывы, запросить доказательства (переписка/фото/счета) и принять меры на наше усмотрение.

---

## 8. Отзывы и рейтинг

**8.1.** После завершения задания стороны могут оставить отзывы/оценки. Запрещены фейковые отзывы, «само-заказы», взаимные накрутки.

**8.2.** Мы можем помечать отзывы как Verified (например, если задание подтверждено/есть доказательства). Алгоритмы рейтинга могут учитывать только Verified-отзывы.

**8.3.** Мы можем скрывать/удалять отзывы, нарушающие закон/правила, либо при наличии обоснованных жалоб и доказательств манипуляций.

---

## 9. Данные и приватность

**9.1.** Обработка данных регулируется Политикой обработки и защиты информации (Privacy Policy), которая является частью настоящего Соглашения.

**9.2.** Мы применяем меры безопасности и можем использовать cookies/SDK. Настройки согласий доступны в интерфейсе.

**9.3.** Вы обязуетесь не загружать документы/данные третьих лиц без законного основания.

---

## 10. Запрещённые услуги/деятельность

Запрещены задания/контент, нарушающие закон ОАЭ, включая, но не ограничиваясь:

- насилие, эксплуатация, контент 18+ и проституция;
- наркотики, оружие, взрывчатые вещества, опасные химикаты;
- мошенничество, хакерство, нелегальный софт/ключи;
- подделка документов, медицинские/юридические услуги без лицензий;
- политическая агитация с нарушением местного законодательства;
- деятельность, нарушающая права ИС или условия третьих лиц.

Мы вправе удалять соответствующие задания, блокировать аккаунты и передавать данные компетентным органам в случаях, предусмотренных законом.

---

## 11. Интеллектуальная собственность и лицензия

**11.1.** Контент Платформы (бренд, дизайн, код, базы данных) — собственность Оператора или лицензодателей.

**11.2.** Вы предоставляете нам неисключительную, безвозмездную лицензию на размещённый вами контент (тексты, фото, видео) для целей работы Платформы, маркетинга и обучения алгоритмов (в пределах закона), с правом технической обработки/модерации.

**11.3.** Вы гарантируете, что обладаете правами на размещаемый контент и не нарушаете права третьих лиц.

---

## 12. Сторонние сервисы

**12.1.** Платформа может использовать/встраивать сторонние сервисы: карты, аналитика, платежи, KYC/анти-фрод, мессенджеры. Их использование регулируется их офертами/политиками.

**12.2.** Мы не отвечаем за работоспособность сторонних сервисов, но стремимся выбирать надёжных поставщиков.

---

## 13. Ограничение ответственности

**13.1.** Платформа предоставляется «как есть». Мы не гарантируем безошибочную/непрерывную работу и соответствие вашим ожиданиям.

**13.2.** В максимальной степени, разрешённой законом ОАЭ, мы не несем ответственности за косвенные убытки, упущенную выгоду, деловую репутацию, а также за действия/безопасность Заказчиков и Исполнителей.

**13.3.** Совокупная ответственность Оператора по всем требованиям, связанным с использованием Платформы, ограничена суммой 500 AED или фактически уплаченными вами в пользу Оператора платными функциями за последние 3 месяца — в зависимости от того, что меньше. Это ограничение не применяется в случаях умысла/грубой небрежности, а также в иных случаях, где ограничение недопустимо по закону.

---

## 14. Компенсация (Indemnity)

Вы обязуетесь возместить Оператору убытки, расходы и претензии третьих лиц, возникшие из-за:
- (i) вашего нарушения Соглашения/закона;
- (ii) нарушений прав ИС;
- (iii) контента, который вы разместили;
- (iv) споров с другими пользователями, если наша ответственность вызвана вашим действием.

---

## 15. Модерация и приостановка

Мы можем без предварительного уведомления:
- (i) скрыть контент;
- (ii) приостановить/ограничить функциональность;
- (iii) удалить аккаунт в случае нарушений Соглашения, закона или обоснованных рисков (мошенничество, фрод, спам, угрозы безопасности).

---

## 16. Уведомления

Официальные уведомления направляются по e-mail/внутрисервисным сообщениям/WhatsApp (если вы согласились). Вы обязаны следить за актуальностью контактов.

---

## 17. Применимое право и споры

**17.1.** Применимое право — материальное право ОАЭ.

**17.2.** Подсудность по умолчанию — Суды Эмирата Дубай.

Разрешение споров в DIAC (Dubai International Arbitration Centre), язык — английский/русский, место арбитража — Дубай, правила DIAC.

**17.3.** Это не лишает нас права обратиться в суд за обеспечительными мерами.

---

## 18. Форс-мажор

Мы не отвечаем за неисполнение, вызванное обстоятельствами вне разумного контроля: перебои у провайдеров, сбои электросети, DDoS, стихийные бедствия, войны, забастовки, нормативные ограничения и т. п.

---

## 19. Изменения Соглашения

Мы можем обновлять Соглашение. Новая редакция вступает в силу с момента публикации на сайте (или с даты, указанной в уведомлении). Продолжая пользоваться Сервисом, вы принимаете изменения. Если вы не согласны — прекратите использование и удалите аккаунт.

---

## 20. Прочее

**20.1.** Недействительность отдельного положения не влияет на действительность остальных.

**20.2.** Невозможность принудить исполнение в одном случае не означает отказа от прав в целом.

**20.3.** Вы не можете уступать права/обязанности по Соглашению без нашего согласия; мы можем уступать в рамках корпоративной реструктуризации.

**20.4.** Официальные версии: [русская/английская]. При расхождении приоритет — [Русская].

---

## 21. Контакты

**Вопросы по Соглашению:** info@youdu.ae

**Вопросы по обработке данных:** verification@youdu.ae  
(см. Политику обработки и защиты информации).
`;

const fallbackTermsEn = `
# YouDu.ae Terms of Service

**Last updated:** 4 November 2025

**Domain:** youdu.ae (and related subdomains/apps) — hereinafter the “Service”, “Platform”, “We”.

By clicking “Sign up”, “Log in”, or otherwise using the Service, you (“User”) accept these Terms and the Privacy Policy. If you do not agree, please stop using the Platform.

---

## 1. Roles and Scope

**1.1.** Customer — a user who posts a job request.

**1.2.** Provider (Specialist) — a user who responds to a job, submits a price/terms, and performs the work.

**1.3.** Scope: We provide an online platform that enables job postings, offers, messaging, reviews, etc. We are not a party to the contract between Customer and Provider and do not guarantee the result, timing, quality, or payment of the work.

---

## 2. Registration and Account

**2.1.** The Service is available to natural persons aged 18+ with full legal capacity.

**2.2.** You must provide accurate information and keep it up to date. One person may only have one primary account. Sharing access with third parties is prohibited.

**2.3.** We may request e-mail verification, phone verification (SMS OTP), and/or identity/company verification (KYC). Failure to complete verification may limit functionality.

---

## 3. Job Posts and Offers

**3.1.** A Customer submits a job: title, description, category, location, budget, photos, etc.

**3.2.** A Provider submits an offer with price/terms. The Customer may select one of the responders or none.

**3.3.** No contract is deemed concluded until the Customer explicitly selects a Provider and confirms the agreed terms.

**3.4.** We may hide or moderate jobs/offers that violate these Terms (see Section 10).

---

## 4. Verification and Trust Levels

**4.1.** Verification (optional) may include providing documents (Emirates ID/passport for individuals; Trade License for companies) and selfie/address confirmation upon request.

**4.2.** Verified accounts receive a “Verified” badge and may gain increased visibility for offers/profiles according to our algorithms.

**4.3.** Verification outcome is our internal decision; we may request additional information or decline without refund if doubts remain.

---

## 5. Communications and Conduct

**5.1.** Chat and smart UI are only for discussing the job. Spam, abuse, discrimination, or sharing third-party personal data without consent are forbidden.

**5.2.** Attempts to circumvent the Platform to avoid rules or fees (if enabled) may lead to restrictions or account suspension.

---

## 6. Payments, Fees, and Subscriptions

**6.1.** During the MVP stage, posting jobs and submitting offers may be free. We reserve the right to introduce subscriptions for Providers, paid boosts, highlight features, commissions, etc., with prior notice.

**6.2.** If a payment service (e.g., Stripe) is enabled, settlement, refunds, and tax rules follow the payment provider’s terms and our pricing.

**6.3.** Taxes and bookkeeping for services performed outside the Platform remain the responsibility of the respective party (Customer/Provider). You confirm compliance with applicable UAE requirements.

---

## 7. Cancellations, Refunds, and User Disputes

**7.1.** Cancellation/refund terms are defined between the Customer and Provider. The Platform is not the seller or service provider.

**7.2.** We may offer informal mediation but are not obliged to resolve disputes.

**7.3.** In case of complaints, we may temporarily restrict accounts, hide ratings/reviews, request evidence (messages/photos/invoices), and take actions at our discretion.

---

## 8. Reviews and Ratings

**8.1.** After the job is finished, both parties may leave reviews/ratings. Fake reviews, self-orders, and reciprocal boosting are prohibited.

**8.2.** We may tag reviews as Verified (for example, if the job was completed with proof). Rating algorithms may weigh Verified reviews only.

**8.3.** We may hide or delete reviews that break the law or rules, or if we have grounded complaints and evidence of manipulation.

---

## 9. Data and Privacy

**9.1.** Data processing is governed by our Privacy Policy, which is an integral part of these Terms.

**9.2.** We apply security measures and may use cookies/SDKs. Consent settings are available within the interface.

**9.3.** You must not upload documents/data of third parties without a legal basis.

---

## 10. Prohibited Services/Activities

The following jobs/content are forbidden if they violate UAE law, including but not limited to:

- violence, exploitation, 18+ content and prostitution;
- drugs, weapons, explosives, hazardous chemicals;
- fraud, hacking, illegal software/keys;
- forged documents, medical/legal services without licensing;
- political campaigning in breach of local law;
- any activity infringing IP rights or third-party terms.

We may delete such jobs, block accounts, and report to competent authorities if required by law.

---

## 11. Intellectual Property and License

**11.1.** Platform content (brand, design, code, databases) is owned by the Operator or licensors.

**11.2.** You grant us a non-exclusive, royalty-free license to content you post (text, photos, videos) to operate the Platform, market it, and train algorithms (as permitted by law), including technical processing/moderation rights.

**11.3.** You warrant that you have the rights to the content you publish and that it does not infringe third-party rights.

---

## 12. Third-Party Services

**12.1.** The Platform may embed third-party services: maps, analytics, payments, KYC/anti-fraud, messengers. Their use is governed by their own terms/policies.

**12.2.** We are not responsible for third-party services’ performance, but we strive to select reliable providers.

---

## 13. Limitation of Liability

**13.1.** The Platform is provided “as is”. We do not warrant error-free or uninterrupted operation or that it meets your expectations.

**13.2.** To the fullest extent permitted by UAE law, we are not liable for indirect damages, loss of profit, business reputation, or for the actions/safety of Customers and Providers.

**13.3.** Our total liability for all claims related to use of the Platform is limited to AED 500 or the paid features you actually purchased from us during the last 3 months — whichever is lower. The limitation does not apply in cases of willful misconduct/gross negligence or where the law prohibits such limitation.

---

## 14. Indemnification

You agree to indemnify the Operator for losses, expenses, and third-party claims arising from:
- (i) your breach of the Terms/law;
- (ii) IP infringements;
- (iii) content you submitted;
- (iv) disputes with other users where our liability stems from your actions.

---

## 15. Moderation and Suspension

We may, without prior notice:
- (i) hide content;
- (ii) suspend/limit functionality;
- (iii) delete an account in case of Terms violations, legal breaches, or justified risks (fraud, spam, security threats).

---

## 16. Notices

Official notices are sent via e-mail, in-product messages, and/or WhatsApp (if you consented). Keep your contact details current.

---

## 17. Governing Law and Disputes

**17.1.** Governing law: substantive law of the UAE.

**17.2.** Default jurisdiction: Courts of the Emirate of Dubai.

Disputes may be referred to DIAC (Dubai International Arbitration Centre); language — English/Russian; seat — Dubai; DIAC rules apply.

**17.3.** This does not prevent us from seeking injunctive relief in court.

---

## 18. Force Majeure

We are not liable for failure caused by events beyond reasonable control: provider outages, power failures, DDoS attacks, natural disasters, wars, strikes, regulatory restrictions, etc.

---

## 19. Changes to the Terms

We may update the Terms. A new version takes effect upon publication on the website (or the date stated in a notice). By continuing to use the Service, you accept the changes. If you disagree, stop using the Platform and delete your account.

---

## 20. Miscellaneous

**20.1.** Invalidity of any provision does not affect the validity of the rest.

**20.2.** Failure to enforce a right in one case does not constitute a waiver.

**20.3.** You may not assign rights/obligations without our consent; we may assign them as part of corporate restructuring.

**20.4.** Official versions: [Russian/English]. In case of discrepancies, the Russian version prevails.

---

## 21. Contacts

**Questions about the Terms:** info@youdu.ae

**Questions about data processing:** verification@youdu.ae  
(see the Privacy Policy).
`;

const metaByLocale = {
  ru: {
    title: 'Пользовательское соглашение | YouDu.ae',
    description:
      'Пользовательское соглашение платформы YouDu.ae - правила использования сервиса для заказчиков и исполнителей в ОАЭ',
  },
  en: {
    title: 'Terms of Service | YouDu.ae',
    description:
      'YouDu.ae Terms of Service – rules for customers and providers using the marketplace in the UAE',
  },
};

export const getFallbackSections = locale => {
  const isRu = locale?.toLowerCase().startsWith('ru');
  const content = isRu ? fallbackTermsRu : fallbackTermsEn;
  const meta = isRu ? metaByLocale.ru : metaByLocale.en;

  return {
    sections: [
      {
        sectionType: 'article',
        sectionId: 'terms',
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

// This is the fallback page, in case there's no Terms of Service asset defined in Console.
const FallbackPage = props => {
  const intl = useIntl();
  const locale = intl?.locale || 'en';
  return <PageBuilder key={`terms-${locale}`} pageAssetsData={getFallbackSections(locale)} {...props} />;
};

export default FallbackPage;
