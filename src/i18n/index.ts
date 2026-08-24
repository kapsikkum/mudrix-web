import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';
import { STORAGE_KEY_LANGUAGE } from '@/const/storageKeys';
import { detectBrowserLanguage } from '@/i18n/languages';

const STORAGE_KEY = STORAGE_KEY_LANGUAGE;
const savedLang = localStorage.getItem(STORAGE_KEY) ?? detectBrowserLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export { STORAGE_KEY };
export default i18n;
