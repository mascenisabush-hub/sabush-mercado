import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, User, Home, Store, Menu, MessageSquare, MessageCircle, PlusCircle, LogOut, X, ChevronRight, Settings, ShieldCheck, Heart, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from '../common/RouteLink';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { cn } from '../../lib/utils';
import { ChatWindow } from './ChatWindow';
import { CompareDrawer } from './CompareDrawer';
import { NotificationTray } from './NotificationTray';
import { LanguageSelector } from '../LanguageSelector';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES, CATEGORY_ICONS, COUNTRIES } from '../../constants';
import { useLocation as useAppLocation } from '../../context/LocationContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { totalItems } = useCart();
  const location = useLocation();
  const { selectedCountry, setCountry } = useAppLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState<{ number: string; message: string; name?: string } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [searchText, setSearchText] = useState('');

  const supportNumber = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER;
  const shouldShowWhatsApp = !!(whatsappConfig || supportNumber);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchText.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchText.trim())}`);
    }
  };

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setWhatsappConfig(customEvent.detail);
      }
    };
    const handleReset = () => {
      setWhatsappConfig(null);
    };

    window.addEventListener('sabush:whatsapp:update', handleUpdate);
    window.addEventListener('sabush:whatsapp:reset', handleReset);

    return () => {
      window.removeEventListener('sabush:whatsapp:update', handleUpdate);
      window.removeEventListener('sabush:whatsapp:reset', handleReset);
    };
  }, []);

  useEffect(() => {
    // Reset WhatsApp config when path changes
    setWhatsappConfig(null);
  }, [location]);

  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin';

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate a bit of loading for UX feedback
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl italic">S</div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">Mercado Sabush</span>
          </Link>

          {/* Search bar - hidden on very small screens, shown in top nav on larger */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-600 transition-colors">
                <Search className="w-4 h-4" />
              </button>
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:block">
              <LanguageSelector />
            </div>
            
            <button 
              onClick={handleRefresh}
              className={cn(
                "p-2 text-gray-400 hover:text-brand-600 transition-all rounded-full hover:bg-gray-100",
                isRefreshing && "animate-spin text-brand-600"
              )}
              title={t('common.refresh')}
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <NotificationTray />

            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-brand-600 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
                  {totalItems}
                </span>
              )}
            </Link>

            {user && (isSeller || isAdmin) && (
              <Link 
                to="/dashboard" 
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100 hover:text-brand-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                <Store className="w-4 h-4 text-brand-600" />
                <span>Minhas Lojas</span>
              </Link>
            )}

            {user && !isSeller && !isAdmin && (
              <Link 
                to="/become-seller" 
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-650 text-white hover:from-brand-700 hover:to-indigo-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:scale-[1.02]"
              >
                <PlusCircle className="w-4 h-4 text-white animate-pulse" />
                <span>{t('home.become_seller', 'Become a Seller')}</span>
              </Link>
            )}

            {user ? (
               <div className="flex items-center gap-2">
                 <Link to={isAdmin ? "/admin" : (isSeller ? "/dashboard" : "/orders")} className="hidden sm:flex items-center gap-2 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                   {user.photoURL ? (
                     <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white" loading="lazy" />
                   ) : (
                     <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600">
                       <User className="w-5 h-5" />
                     </div>
                   )}
                   <span className="text-sm font-medium pr-2">{profile?.displayName?.split(' ')[0] || 'User'}</span>
                 </Link>
                 <button 
                   onClick={handleSignOut}
                   className="hidden sm:flex p-2 text-gray-400 hover:text-red-600 transition-colors"
                   title={t('nav.logout')}
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
               </div>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                <Link to="/become-seller" className="py-2.5 px-6 bg-brand-600 hover:bg-brand-700 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-brand-100 hover:scale-[1.02] cursor-pointer">
                  {t('home.become_seller', 'Become a Seller')}
                </Link>
              </div>
            )}

            <button 
              onClick={() => setIsMenuOpen(true)}
              className="sm:hidden p-2 text-gray-600 active:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Side Menu (Drawer) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm sm:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[80%] max-w-sm bg-white z-[70] shadow-2xl flex flex-col sm:hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <span className="font-black text-lg italic text-brand-600 uppercase tracking-tighter">Menu</span>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
                {/* User Section in Menu */}
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-brand-50 rounded-2xl">
                      {user.photoURL ? (
                        <img src={user.photoURL} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="" loading="lazy" />
                      ) : (
                        <div className="w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                          {profile?.displayName?.[0] || user.email?.[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 truncate">{profile?.displayName || 'User'}</p>
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{profile?.role || 'Customer'}</p>
                      </div>
                    </div>
                    
                    {(isSeller || isAdmin) && (
                      <Link 
                        to="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between p-4 bg-brand-500/5 hover:bg-brand-50 border border-brand-100 rounded-xl transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <Store className="w-5 h-5 text-brand-600 animate-pulse" />
                          <span className="font-extrabold text-brand-850">Minhas Lojas (My Shops)</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-brand-400" />
                      </Link>
                    )}

                    {user && !isSeller && !isAdmin && (
                      <Link 
                        to="/become-seller"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-brand-600 to-indigo-650 text-white rounded-xl transition-all duration-200 shadow-md group border border-brand-100"
                      >
                        <div className="flex items-center gap-3">
                          <PlusCircle className="w-5 h-5 text-white animate-pulse" />
                          <span className="font-extrabold">{t('home.become_seller', 'Become a Seller')}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/85" />
                      </Link>
                    )}

                    <Link 
                      to={isAdmin ? "/admin" : (isSeller ? "/dashboard" : "/orders")}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
                        <span className="font-bold text-gray-900">{isAdmin ? 'Admin Panel' : (isSeller ? 'Seller Dashboard' : 'My Orders')}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </Link>

                    <Link 
                      to="/wishlist"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Heart className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                        <span className="font-bold text-gray-900">My Wishlist</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </Link>

                    <button 
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleRefresh();
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className={cn("w-5 h-5 text-gray-400 group-hover:text-brand-600", isRefreshing && "animate-spin")} />
                        <span className="font-bold text-gray-900">{t('common.refresh')}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-3xl space-y-3">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest text-center">Junte-se ao Mercado Sabush</p>
                    <Link 
                      to="/become-seller"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full block py-3.5 bg-brand-600 text-white text-center rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-brand-700 active:scale-95 transition-all cursor-pointer"
                    >
                      {t('home.become_seller', 'Become a Seller')}
                    </Link>
                  </div>
                )}

                {/* Categories Section */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Top Categories</p>
                  <div className="grid grid-cols-1 gap-1">
                    {CATEGORIES.slice(0, 8).map((cat) => {
                       const Icon = CATEGORY_ICONS[cat.icon];
                       return (
                         <Link 
                           key={cat.id}
                           to={`/marketplace?category=${cat.id}`}
                           onClick={() => setIsMenuOpen(false)}
                           className="flex items-center justify-between p-3 hover:bg-brand-50 rounded-xl transition-colors group"
                         >
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 flex items-center justify-center text-gray-400 group-hover:text-brand-600 group-hover:bg-white rounded-lg transition-colors">
                               {Icon && <Icon className="w-5 h-5" />}
                             </div>
                             <span className="text-sm font-bold text-gray-700">{t(cat.translationKey || cat.name, cat.name)}</span>
                           </div>
                           <ChevronRight className="w-4 h-4 text-gray-200" />
                         </Link>
                       );
                    })}
                    <Link to="/marketplace" onClick={() => setIsMenuOpen(false)} className="text-brand-600 text-xs font-black uppercase tracking-widest p-4 text-center hover:underline italic">
                      View All Categories
                    </Link>
                  </div>
                </div>

                {/* Support / Legal */}
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <Link to="/help" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 text-gray-500 hover:text-gray-900 transition-colors">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm font-medium">Safety Center</span>
                  </Link>
                  <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 text-gray-500 hover:text-gray-900 transition-colors">
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>
                </div>
              </div>

              {user && (
                <div className="p-6 border-t border-gray-100">
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> {t('nav.logout')}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 pb-20 sm:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-center justify-between px-6 z-40">
        <Link to="/" className={cn("flex flex-col items-center gap-1", location === '/' ? "text-brand-600" : "text-gray-400")}>
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">{t('nav.home')}</span>
        </Link>
        <Link to="/marketplace" className={cn("flex flex-col items-center gap-1", location === '/marketplace' ? "text-brand-600" : "text-gray-400")}>
          <Store className="w-6 h-6" />
          <span className="text-[10px] font-medium">{t('nav.marketplace')}</span>
        </Link>
        <div className="flex flex-col items-center">
          <LanguageSelector variant="nav" align="top" />
        </div>
        <Link to="/chat" className={cn("flex flex-col items-center gap-1", location === '/chat' ? "text-brand-600" : "text-gray-400")}>
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-medium">Chat</span>
        </Link>
        <Link to={user ? (isAdmin ? "/admin" : (isSeller ? "/dashboard" : "/orders")) : "/login"} className={cn("flex flex-col items-center gap-1", (location === '/orders' || location === '/dashboard' || location === '/admin') ? "text-brand-600" : "text-gray-400")}>
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Account</span>
        </Link>
        {user && (
          <button 
            onClick={handleSignOut}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] font-medium">{t('nav.logout')}</span>
          </button>
        )}
      </nav>

      {/* WhatsApp Floating Button - Mozambique real-time assist */}
      {shouldShowWhatsApp && (
        <div 
          className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[45] flex flex-col items-end"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="mb-3 bg-white border border-gray-100 rounded-2xl shadow-2xl p-4 w-72 text-left relative"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 relative">
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
                    <MessageCircle className="w-5 h-5 fill-white text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-gray-900 leading-tight uppercase tracking-wider mb-0.5">
                      {whatsappConfig ? (whatsappConfig.name ? whatsappConfig.name : "Contacto com Vendedor") : "Apoio Mercado Sabush"}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-bold mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                      <span>Conexão Segura 🇲🇿 Moçambique</span>
                    </p>
                    <p className="text-[11px] text-gray-650 font-medium leading-relaxed">
                      {whatsappConfig 
                        ? "Fale directamente com o vendedor no WhatsApp para agendar a entrega rápida e tirar dúvidas." 
                        : "Dúvidas ou ajuda nas compras? Fale com a nossa equipa de apoio em tempo real."}
                    </p>
                  </div>
                </div>
                <div className="absolute top-full right-6 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45 -translate-y-1.5" />
              </motion.div>
            )}
          </AnimatePresence>

          <a
            href={
              whatsappConfig 
                ? `https://wa.me/${whatsappConfig.number.replace(/\s+/g, '').replace(/\+/g, '')}?text=${encodeURIComponent(whatsappConfig.message)}` 
                : `https://wa.me/${(supportNumber || '').replace(/\s+/g, '').replace(/\+/g, '')}?text=${encodeURIComponent("Olá, Suporte Sabush! Preciso de ajuda para navegar no mercado ou com a minha conta de comprador.")}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#128C7E] text-white p-3.5 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center relative group active:scale-95"
            aria-label="Contact via WhatsApp"
          >
            {/* Glowing pulse rings background */}
            <span className="absolute inset-0 bg-[#25D366] rounded-full -z-10 animate-ping opacity-25 scale-105" />
            <MessageCircle className="w-7 h-7 fill-white text-[#25D366]" />
            
            {whatsappConfig && (
              <span className="absolute -top-1 -right-1 bg-brand-600 text-[9px] font-black uppercase text-white px-2 py-0.5 rounded-full border-2 border-white animate-bounce tracking-widest">
                Lojista
              </span>
            )}
          </a>
        </div>
      )}

      <ChatWindow />
      <CompareDrawer />
    </div>
  );
}
