import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import ptCommon from './locales/pt/common.json';
import frCommon from './locales/fr/common.json';

const resources = {
  en: {
    common: enCommon,
  },
  pt: {
    common: ptCommon,
  },
  fr: {
    common: frCommon,
  },
};

// Immediately query localStorage or default to 'pt' to prevent language flicker
const savedLanguage = localStorage.getItem('i18nextLng') || 'pt';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt',
    lng: savedLanguage,
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
