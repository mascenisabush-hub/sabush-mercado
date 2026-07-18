import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';

interface TranslatedTextProps {
  text: string;
  senderLanguage?: string;
  messageId: string;
}

const flagMap: Record<string, string> = {
  pt: '🇲🇿',
  en: '🇬🇧',
  fr: '🇫🇷'
};

const langNameMap: Record<string, string> = {
  pt: 'Português',
  en: 'English',
  fr: 'Français'
};

// Global translation caches
const translationCache: Record<string, string> = {};
const activeRequests: Record<string, Promise<string | null> | null> = {};

interface TranslationRequest {
  cacheKey: string;
  text: string;
  targetLang: string;
  resolve: (val: string | null) => void;
}

const translationQueue: TranslationRequest[] = [];
let isProcessingQueue = false;

// Global rate-limited sequential scheduler
export function scheduleTranslation(cacheKey: string, text: string, targetLang: string): Promise<string | null> {
  if (translationCache[cacheKey]) {
    return Promise.resolve(translationCache[cacheKey]);
  }

  if (activeRequests[cacheKey]) {
    return activeRequests[cacheKey]!;
  }

  const promise = new Promise<string | null>((resolve) => {
    translationQueue.push({ cacheKey, text, targetLang, resolve });
    triggerQueueProcessing();
  });

  activeRequests[cacheKey] = promise;
  return promise;
}

async function triggerQueueProcessing() {
  if (isProcessingQueue || translationQueue.length === 0) return;
  isProcessingQueue = true;

  while (translationQueue.length > 0) {
    const req = translationQueue.shift();
    if (!req) continue;

    // Sequential rate limit spacer (200ms gap to avoid slamming Gemini or proxy)
    await new Promise((r) => setTimeout(r, 200));

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          text: req.text,
          targetLanguages: [req.targetLang]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const result = data[req.targetLang];
        if (result) {
          translationCache[req.cacheKey] = result;
          req.resolve(result);
        } else {
          // If result format is unexpected, cache the original text to act as a failure marker
          translationCache[req.cacheKey] = req.text;
          req.resolve(null);
        }
      } else {
        // Cache the original text as marker so we NEVER retry on error
        translationCache[req.cacheKey] = req.text;
        req.resolve(null);
      }
    } catch (err) {
      console.error('Translation error in scheduler:', err);
      translationCache[req.cacheKey] = req.text;
      req.resolve(null);
    } finally {
      delete activeRequests[req.cacheKey];
    }
  }

  isProcessingQueue = false;
}

export function TranslatedText({ text, senderLanguage = 'pt', messageId }: TranslatedTextProps) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'pt';

  const normSender = senderLanguage.split('-')[0].toLowerCase();
  const normCurrent = currentLang.split('-')[0].toLowerCase();
  const needsTranslation = normSender !== normCurrent;

  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);

  const cacheKey = `${messageId}_to_${normCurrent}`;

  useEffect(() => {
    if (!needsTranslation) {
      setTranslatedText(null);
      return;
    }

    if (translationCache[cacheKey]) {
      const cached = translationCache[cacheKey];
      setTranslatedText(cached === text ? null : cached);
      return;
    }

    let isMounted = true;
    setLoading(true);

    scheduleTranslation(cacheKey, text, normCurrent).then((result) => {
      if (!isMounted) return;
      setLoading(false);
      if (result && result !== text) {
        setTranslatedText(result);
      } else {
        setTranslatedText(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [text, normSender, normCurrent, cacheKey, needsTranslation]);

  if (!needsTranslation) {
    return <span className="break-words whitespace-pre-wrap">{text}</span>;
  }

  const senderFlag = flagMap[normSender] || '🌐';
  const senderName = langNameMap[normSender] || normSender.toUpperCase();
  const currentFlag = flagMap[normCurrent] || '🌐';
  const currentName = langNameMap[normCurrent] || normCurrent.toUpperCase();

  return (
    <div className="flex flex-col gap-1 mx-0.5">
      {loading ? (
        <span className="flex items-center gap-1.5 py-1 text-xs text-blue-500 font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="italic opacity-80">Translating...</span>
        </span>
      ) : showOriginal ? (
        <>
          <span className="break-words whitespace-pre-wrap">{text}</span>
          <button
            type="button"
            onClick={() => setShowOriginal(false)}
            className="flex items-center gap-1.5 mt-2 border-t border-gray-100/20 pt-1 text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors cursor-pointer select-none"
          >
            <Globe className="w-2.5 h-2.5" />
            <span>Show Translation ({senderFlag} Original)</span>
          </button>
        </>
      ) : (
        <>
          <span className="break-words whitespace-pre-wrap">{translatedText || text}</span>
          {translatedText && (
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              className="flex items-center gap-1.5 mt-2 border-t border-gray-100/20 pt-1 text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors cursor-pointer select-none"
            >
              <Globe className="w-2.5 h-2.5" />
              <span>Translated to {currentFlag} {currentName} (View original)</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
