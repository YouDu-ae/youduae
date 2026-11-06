// Адреса не зависят от окружения: по ним поисковики собирают упоминания основателя в одного человека
const ABOUT_URL = 'https://youdu.ae/p/about';

export const FOUNDER_ID = `${ABOUT_URL}#aleksandr-gross`;

const FOUNDER_NAMES = ['Aleksandr Gross', 'Александр Гросс', 'Alexander Gross'];

const FOUNDER_PROFILES = [
  'https://www.linkedin.com/in/aleksandr-gross-aa2155383',
  'https://www.instagram.com/less.grossman____/',
];

const normalizeName = name =>
  String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const isFounderName = name =>
  FOUNDER_NAMES.some(founderName => normalizeName(founderName) === normalizeName(name));

// name — написание, которое видно на странице, остальные уходят в alternateName
export const founderPerson = (name = FOUNDER_NAMES[0]) => ({
  '@type': 'Person',
  '@id': FOUNDER_ID,
  name,
  alternateName: FOUNDER_NAMES.filter(n => normalizeName(n) !== normalizeName(name)),
  url: ABOUT_URL,
  sameAs: FOUNDER_PROFILES,
});

export const authorPerson = name =>
  isFounderName(name) ? founderPerson(name) : { '@type': 'Person', name };
