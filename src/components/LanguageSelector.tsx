import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const LanguageSelector: React.FC<{ variant?: 'nav' | 'minimal' | 'full', align?: 'top' | 'bottom' }> = ({ variant = 'nav', align = 'bottom' }) => {
  const { i18n } = useTranslation();
  const { language: currentLangCode, changeLanguage, languages } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === currentLangCode) || languages[0];

  // Handle click outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = async (code: string) => {
    await changeLanguage(code);
    setIsOpen(false);
    
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredLanguage: code
        });
      } catch (error) {
        console.error('Error saving language preference to user profile:', error);
      }
    }
  };

  if (variant === 'minimal') {
    return (
      <div className="flex gap-2 sm:gap-4 flex-wrap">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
              currentLangCode === lang.code 
                ? "bg-blue-600 text-white" 
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            <span className="text-base">{lang.dropdownFlag}</span>
            <span>{lang.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
          variant === 'nav' 
            ? "hover:bg-gray-100 text-gray-700 font-bold text-sm"
            : "bg-white border border-gray-100 shadow-sm text-gray-900 font-bold"
        )}
      >
        <Globe className="w-4 h-4 text-blue-600" />
        <span className="hidden md:inline">{currentLanguage.navbarFlag} {currentLanguage.name}</span>
        <span className="md:hidden">{currentLanguage.navbarFlag}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform text-gray-400", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: align === 'top' ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: align === 'top' ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden",
              align === 'top' 
                ? "bottom-full left-1/2 -translate-x-1/2 mb-4" 
                : "right-0 mt-2"
            )}
          >
            <div className="p-2 space-y-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-colors text-left",
                    currentLangCode === lang.code
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{lang.dropdownFlag}</span>
                    <span>{lang.name}</span>
                  </span>
                  {currentLangCode === lang.code && <Check className="w-4 h-4 text-blue-600 stroke-[3]" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
