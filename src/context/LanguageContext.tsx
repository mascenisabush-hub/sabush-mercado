import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageContextType {
  language: string;
  changeLanguage: (code: string) => Promise<void>;
  languages: Array<{
    code: string;
    name: string;
    dropdownFlag: string;
    navbarFlag: string;
  }>;
}

const languages = [
  { code: 'pt', name: 'Português (PT)', dropdownFlag: '🇲🇿', navbarFlag: '🇲🇿' },
  { code: 'en', name: 'English (EN)', dropdownFlag: '🇬🇧', navbarFlag: '🇬🇧' },
];

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('i18nextLng') || i18n.language || 'pt';
  });

  useEffect(() => {
    // Keep internal react state in sync when i18n finishes initializing or changes language
    if (i18n.language && i18n.language !== language) {
      setLanguageState(i18n.language);
    }
  }, [i18n.language, language]);

  const changeLanguage = async (code: string) => {
    await i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    setLanguageState(code);
    
    // Explicitly dispatch a storage event so all tabs/iframes update if listening
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
