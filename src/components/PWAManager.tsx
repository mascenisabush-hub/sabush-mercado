import React, { useState, useEffect } from 'react';
import { Download, Wifi, WifiOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function PWAManager() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Only show after a small delay or certain user interaction
      setTimeout(() => setShowInstallBanner(true), 5000);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineStatus(true);
      setTimeout(() => setShowOnlineStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineStatus(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallBanner(false);
    }
  };

  return (
    <>
      {/* Offline/Online Notification */}
      <AnimatePresence>
        {showOnlineStatus && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={cn(
              "fixed top-0 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-md",
              isOnline 
                ? "bg-green-50 border-green-200 text-green-700" 
                : "bg-red-50 border-red-200 text-red-700"
            )}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-xs font-black uppercase tracking-widest">
              {isOnline ? "De volta online" : "Você está offline"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install App Banner */}
      <AnimatePresence>
        {showInstallBanner && installPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50 bg-white rounded-3xl shadow-2xl border border-blue-50 p-6 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
            <button 
              onClick={() => setShowInstallBanner(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">
                M
              </div>
              <div>
                <h4 className="font-black text-gray-900 text-sm">Mercado Sabush</h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Instale para melhor experiência</p>
              </div>
            </div>
            <button
              onClick={handleInstall}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Download className="w-4 h-4" /> Instalar App
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
