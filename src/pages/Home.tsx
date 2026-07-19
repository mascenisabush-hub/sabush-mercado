import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, ArrowRight, Star, Truck, ShieldCheck, Zap, Store, MessageSquare, PlusCircle, Clock, Trash2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '../components/common/RouteLink';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import { SafeImage } from '../components/common/SafeImage';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getTranslatedField } from '../lib/i18nUtils';
import heroBg from '../assets/images/mercado_sabush_hero_marketplace.jpg';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ProductSkeleton, StoreSkeleton } from '../components/common/Skeleton';
import { useLocation as useUserLocation } from '../context/LocationContext';
import { ProductCard } from '../components/common/ProductCard';

export function Home() {
  const { t, i18n } = useTranslation();
  const { language: currentLang, changeLanguage } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mobileSearchText, setMobileSearchText] = useState('');
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileSearchText.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(mobileSearchText.trim())}`);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sabush:recently-viewed');
      if (raw) {
        setRecentlyViewed(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Error loading recently viewed products:", e);
    }
  }, []);

  const handleClearRecentlyViewed = () => {
    try {
      localStorage.removeItem('sabush:recently-viewed');
      setRecentlyViewed([]);
    } catch (e) {
      console.error("Error clearing recently viewed products:", e);
    }
  };

  const { selectedCountry } = useUserLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<Record<string, any>>({});
  const [featuredSellers, setFeaturedSellers] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [sellersLoading, setSellersLoading] = useState(true);

  useEffect(() => {
    setProductsLoading(true);
    const fetchProducts = async () => {
      try {
        let productDocs: any[] = [];
        try {
          // 1. Try querying country-specific trending products (ordered by reviewCount desc)
          const q = query(
            collection(db, 'products'),
            where('status', '==', 'active'),
            where('country', '==', selectedCountry?.code || 'MZ'),
            orderBy('reviewCount', 'desc'),
            limit(8)
          );
          const querySnapshot = await getDocs(q);
          productDocs = querySnapshot.docs;
        } catch (idxError) {
          console.warn("Country trending index query failed, trying global query:", idxError);
          try {
            // 2. Try querying global trending products (ordered by reviewCount desc)
            const q = query(
              collection(db, 'products'),
              where('status', '==', 'active'),
              orderBy('reviewCount', 'desc'),
              limit(8)
            );
            const querySnapshot = await getDocs(q);
            productDocs = querySnapshot.docs;
          } catch (globalIdxError) {
            console.warn("Global trending index query failed, falling back to in-memory sort:", globalIdxError);
            // 3. Fallback: fetch active products and sort in-memory
            const fallbackQuery = query(
              collection(db, 'products'),
              where('status', '==', 'active')
            );
            const querySnapshot = await getDocs(fallbackQuery);
            productDocs = [...querySnapshot.docs]
              .filter(doc => !selectedCountry?.code || doc.data().country === selectedCountry.code)
              .sort((a, b) => (b.data().reviewCount || 0) - (a.data().reviewCount || 0))
              .slice(0, 8);
          }
        }

        const productList = productDocs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productList);

        const storeIds = Array.from(new Set(productList.map((p: any) => p.storeId)));
        const fetchedStores: Record<string, any> = {};
        if (storeIds.length > 0) {
          for (let i = 0; i < storeIds.length; i += 10) {
            const chunk = storeIds.slice(i, i + 10);
            const sq = query(collection(db, 'stores'), where('__name__', 'in', chunk));
            const sSnapshot = await getDocs(sq);
            sSnapshot.forEach(doc => {
              fetchedStores[doc.id] = { id: doc.id, ...doc.data() };
            });
          }
        }
        setStores(prev => ({ ...prev, ...fetchedStores }));
      } catch (error) {
        console.error("Error fetching trending products:", error);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCountry?.code]);

  useEffect(() => {
    setSellersLoading(true);
    const fetchSellers = async () => {
      try {
        let storeDocs: any[] = [];
        try {
          // 1. Try querying country-specific stores (ordered by reviewCount desc)
          const q = query(
            collection(db, 'stores'),
            where('status', '==', 'active'),
            where('country', '==', selectedCountry?.code || 'MZ'),
            orderBy('reviewCount', 'desc'),
            limit(6)
          );
          const querySnapshot = await getDocs(q);
          storeDocs = querySnapshot.docs;
        } catch (idxError) {
          console.warn("Country stores index query failed, trying global query:", idxError);
          try {
            // 2. Try querying global stores (ordered by reviewCount desc)
            const q = query(
              collection(db, 'stores'),
              where('status', '==', 'active'),
              orderBy('reviewCount', 'desc'),
              limit(6)
            );
            const querySnapshot = await getDocs(q);
            storeDocs = querySnapshot.docs;
          } catch (globalIdxError) {
            console.warn("Global stores index query failed, falling back to in-memory sort:", globalIdxError);
            // 3. Fallback: fetch active stores and sort in-memory
            const fallbackQuery = query(
              collection(db, 'stores'),
              where('status', '==', 'active')
            );
            const querySnapshot = await getDocs(fallbackQuery);
            storeDocs = [...querySnapshot.docs]
              .filter(doc => !selectedCountry?.code || doc.data().country === selectedCountry.code)
              .sort((a, b) => (b.data().reviewCount || 0) - (a.data().reviewCount || 0))
              .slice(0, 6);
          }
        }

        const sellersList = storeDocs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeaturedSellers(sellersList);
      } catch (error) {
        console.error("Error fetching featured sellers:", error);
      } finally {
        setSellersLoading(false);
      }
    };

    fetchSellers();
  }, [selectedCountry?.code]);

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* Hero Section with Beautiful Vibrant Background Image */}
      <section 
        className="relative h-[540px] flex items-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Modern Rich Radial Gradient Overlay to ensure crisp legibility and high contrast contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-950/85 to-gray-950/80 z-0" />
        
        <div className="absolute inset-0 opacity-25 z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-400 rounded-full blur-3xl -ml-10 -mb-10"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 w-full relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight md:leading-[1.1] tracking-tight uppercase shadow-sm"
            >
              {currentLang === 'pt' ? (
                <>
                  ENCONTRE PRODUTOS DE <span className="text-orange-400">RETALHISTAS</span> E <span className="text-emerald-400">GROSSISTAS</span> PERTO DE SI.
                </>
              ) : (
                <>
                  FIND PRODUCTS FROM <span className="text-orange-400">RETAILERS</span> AND <span className="text-emerald-400">WHOLESALERS</span> NEAR YOU.
                </>
              )}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-blue-100 text-lg md:text-xl mt-6 max-w-lg mx-auto md:mx-0 font-medium leading-relaxed"
            >
              {t('home.hero_subtitle')}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center md:justify-start items-center"
            >
              <Link to="/marketplace" className="px-8 py-4 bg-white text-blue-600 font-black text-sm rounded-xl shadow-lg hover:bg-gray-100 transform hover:scale-105 transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                {t('home.browse_products')} <ShoppingBag className="w-5 h-5" />
              </Link>
              
              {!user && (
                <div className="flex bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-1">
                  <Link to="/login" className="px-6 py-3 text-white font-black text-sm hover:bg-white/10 rounded-lg transition-all uppercase tracking-widest">
                    {t('nav.login')}
                  </Link>
                  <Link to="/login?mode=register" className="px-6 py-3 bg-white text-blue-600 font-black text-sm rounded-lg shadow-xl hover:scale-105 transition-all uppercase tracking-widest">
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              {/* Home Language Toggle */}
              <div className="flex bg-white/20 backdrop-blur-md rounded-xl p-1 border border-white/30 ml-0 sm:ml-4">
                <button 
                  onClick={() => changeLanguage('pt')} 
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-black transition-all",
                    currentLang === 'pt' ? "bg-white text-blue-600 shadow-sm" : "text-white hover:bg-white/10"
                  )}
                >
                  PT
                </button>
                <button 
                  onClick={() => changeLanguage('en')} 
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-black transition-all",
                    currentLang === 'en' ? "bg-white text-blue-600 shadow-sm" : "text-white hover:bg-white/10"
                  )}
                >
                  EN
                </button>
              </div>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex-1 hidden md:block max-w-md"
          >
            <div className="relative">
               <img 
                 src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=600" 
                 alt="Mozambique Shopping Professional Merchant" 
                 loading="lazy"
                 className="rounded-3xl shadow-2xl border-4 border-white transform rotate-3 hover:rotate-0 transition-transform duration-500 aspect-[4/3] object-cover"
               />
               <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-lg flex items-center gap-3 border border-gray-100">
                 <div className="bg-green-100 p-2.5 rounded-xl text-green-600 shrink-0">
                    <Truck className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t('home.fast_delivery')}</p>
                    <p className="text-sm font-black text-gray-900">{t('home.delivery_countrywide')}</p>
                 </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Marketplace Search (for mobile/hero sub) */}
      <section className="max-w-4xl mx-auto px-4 -mt-10 relative z-20 w-full md:hidden">
        <form onSubmit={handleMobileSearchSubmit} className="bg-white p-2 rounded-2xl shadow-xl border border-gray-100 flex items-center">
          <button type="submit" className="p-3 text-gray-400 hover:text-blue-600 transition-colors">
            <Search className="w-6 h-6" />
          </button>
          <input 
            type="text" 
            placeholder={t('home.search_placeholder')} 
            value={mobileSearchText}
            onChange={(e) => setMobileSearchText(e.target.value)}
            className="flex-1 py-4 border-none focus:ring-0 text-gray-700 bg-transparent focus:outline-none"
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center">
             <ArrowRight className="w-6 h-6" />
          </button>
        </form>
      </section>

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-4 w-full grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { icon: ShieldCheck, title: t('home.verified_sellers'), desc: t('home.safe_shopping'), color: "blue" },
          { icon: Zap, title: t('home.fast_delivery'), desc: t('home.countrywide'), color: "orange" },
          { icon: MessageSquare, title: t('home.chat_sellers'), desc: t('home.whatsapp_ready'), color: "green" },
          { icon: Star, title: t('home.quality_goods'), desc: t('home.top_rated'), color: "purple" }
        ].map((badge, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className={`p-3 rounded-xl bg-${badge.color}-50 text-${badge.color}-600`}>
              <badge.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{badge.title}</p>
              <p className="text-xs text-gray-500">{badge.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('home.browse_categories')}</h2>
          <Link to="/marketplace" className="text-brand-600 font-semibold text-sm flex items-center gap-1 hover:underline">
            {t('home.see_all')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {CATEGORIES.slice(0, 14).map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] || ShoppingBag;
            return (
              <Link 
                key={cat.id} 
                to={`/marketplace?category=${cat.id}`} 
                className="group relative h-48 rounded-3xl overflow-hidden border border-gray-100/10 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-500 flex flex-col justify-end p-5 text-left"
              >
                {/* Background Image & Overlay */}
                <div className="absolute inset-0 z-0">
                  <SafeImage 
                    src={cat.image} 
                    alt={cat.name} 
                    fallbackText={cat.name}
                    fallbackType="product"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  {/* Premium dark gradient overlay ensuring solid background contrast for text readability under any brightness */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent group-hover:from-slate-950/100 transition-all duration-500" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-start w-full">
                  <div className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-white mb-3 group-hover:bg-blue-600 group-hover:scale-105 transition-all duration-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-black text-white leading-snug mb-1 line-clamp-1 group-hover:text-blue-200 transition-colors">
                    {cat.translationKey ? t(cat.translationKey) : cat.name}
                  </p>
                  <p className="text-[9px] text-gray-300/90 uppercase tracking-widest font-black">
                    {cat.productCount}+ {t('common.products', 'Products')}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trending Products */}
      {(!productsLoading && products.length === 0) ? null : (
        <section className="max-w-7xl mx-auto px-4 w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('home.trending_products')}</h2>
            <Link to="/marketplace" className="text-brand-600 font-semibold text-sm hover:underline">{t('common.view_all')}</Link>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {productsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <ProductSkeleton key={i} />
              ))
            ) : (
              products.map((prod) => (
                <ProductCard 
                  key={prod.id} 
                  product={prod} 
                  store={stores[prod.storeId]} 
                  animate={false} 
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* Recently Viewed Section */}
      {recentlyViewed.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 w-full animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {currentLang === 'pt' ? 'Vistos Recentemente' : 'Recently Viewed'}
                </h2>
                <p className="text-xs text-gray-500 font-medium tracking-tight mt-0.5">
                  {currentLang === 'pt' ? 'Produtos que andou a pesquisar ultimamente.' : 'Items you browsed recently on Mercado Sabush.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClearRecentlyViewed}
              className="text-[11px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-red-100"
              title={currentLang === 'pt' ? 'Limpar histórico' : 'Clear history'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {currentLang === 'pt' ? 'Limpar Histórico' : 'Clear History'}
            </button>
          </div>

          <div className="flex overflow-x-auto gap-6 pb-4 pt-1 snap-x no-scrollbar">
            {recentlyViewed.map((item, idx) => {
              const prod = item.product;
              if (!prod) return null;
              
              const translatedName = getTranslatedField(prod, 'name', prod.name);
              const productCategory = CATEGORIES.find(c => c.id === prod.category);
              const categoryLabel = productCategory 
                ? (productCategory.translationKey ? t(productCategory.translationKey) : productCategory.name)
                : prod.category;
              const productImg = prod.images?.[0] || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=70&w=300';
              const ratingVal = prod.rating || 4.8;
              const reviewCountVal = prod.reviewCount || 0;

              return (
                <div 
                  key={`${prod.id}-${idx}`} 
                  className="w-52 sm:w-60 flex-shrink-0 bg-white rounded-3xl border border-gray-100 overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300 snap-start flex flex-col justify-between"
                >
                  <Link to={`/product/${prod.id}`}>
                    <div className="relative h-36 sm:h-40 overflow-hidden bg-gray-50">
                      <img 
                        src={productImg} 
                        alt={translatedName} 
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {prod.deliveryAvailable && (
                        <div className="absolute bottom-2 left-2 bg-emerald-500/95 backdrop-blur-sm text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-green-400/20">
                          {t('home.delivery_available')}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-widest mb-1 block">
                        {categoryLabel}
                      </span>
                      <Link to={`/product/${prod.id}`}>
                        <h4 className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight hover:text-blue-650 transition-colors line-clamp-2 min-h-[2.5rem]">
                          {translatedName}
                        </h4>
                      </Link>
                      
                      <div className="flex items-center gap-1 my-1.5">
                        <div className="flex items-center text-orange-400">
                          <Star className="w-3 h-3 fill-orange-400" />
                        </div>
                        <span className="text-[10px] font-black text-gray-800">{ratingVal}</span>
                        {reviewCountVal > 0 && (
                          <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">({reviewCountVal})</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-black text-blue-600 leading-none">
                            {formatCurrency(prod.price, prod.currency || 'MZN')}
                          </p>
                        </div>
                        <Link to={`/product/${prod.id}`} className="w-8 h-8 bg-gray-50 hover:bg-blue-650 hover:text-white text-gray-500 rounded-full flex items-center justify-center transition-all border border-gray-100">
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </Link>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-550 mt-1">
                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                          <Store className="w-3 h-3 text-gray-400 shrink-0" />
                          {item.storeName || 'Dono da Loja'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Call to Action for Sellers */}
      <section className="max-w-7xl mx-auto px-4 w-full">
        <div className="bg-gradient-to-br from-gray-900 via-brand-950 to-gray-950 rounded-4xl p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 border border-brand-900/40">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
             <div className="grid grid-cols-4 gap-4 transform rotate-12 scale-150">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-brand-400 rounded-2xl"></div>
                ))}
             </div>
          </div>
          
          <div className="flex-1 relative z-10 text-center md:text-left">
            <span className="px-4 py-1.5 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-full text-xs font-black uppercase tracking-widest inline-block mb-6">
              {currentLang === 'pt' ? 'VENDEDORES E GROSSISTAS' : 'SELLERS & WHOLESALERS'}
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight uppercase">
              {currentLang === 'pt' ? (
                <>Traga a sua <span className="text-accent-400">Loja</span> para onde <span className="text-brand-400">Todos</span> a Podem Ver!</>
              ) : (
                <>Bring Your <span className="text-accent-400">Shop</span> to where <span className="text-brand-400">Everyone</span> Can See It!</>
              )}
            </h2>
            <p className="text-gray-300 text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              {currentLang === 'pt' ? (
                "Sabia que pode registar a sua loja gratuitamente no Mercado Sabush e receber encomendas automáticas directamente no seu WhatsApp? Aumente as suas vendas e seja visto por milhares de clientes na sua cidade através do nosso sistema de geolocalização."
              ) : (
                "Did you know you can register your store for free on Mercado Sabush and receive automated orders directly on your WhatsApp? Boost your sales and be discovered by thousands of active buyers with pinpoint GPS proximity."
              )}
            </p>
            
            {/* Value Props Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left max-w-xl">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-success-500/10 rounded-lg text-success-400 mt-1 border border-success-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">
                    {currentLang === 'pt' ? 'Visibilidade Geográfica GPS' : 'Geographic GPS Proximity'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {currentLang === 'pt' ? 'Os clientes encontram a sua loja pela proximidade GPS.' : 'Clients trace and browse stores based on distance proximity.'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-accent-400/10 rounded-lg text-accent-400 mt-1 border border-accent-400/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">
                    {currentLang === 'pt' ? 'Encomendas no WhatsApp' : 'Direct Orders via WhatsApp'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {currentLang === 'pt' ? 'Carrinhos de compras convertem em chats diretos no telemóvel.' : 'Shopping carts convert seamlessly into direct cell chats.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center md:justify-start items-center">
              {profile?.role === 'seller' ? (
                <Link 
                  to="/dashboard" 
                  className="px-8 py-5 bg-gradient-to-r from-success-500 to-success-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-success-500/20 hover:scale-[1.03] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Store className="w-5 h-5 animate-pulse" />
                  {currentLang === 'pt' ? 'Entrar no Meu Painel de Vendedor' : 'Go to My Seller Dashboard'} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link 
                  to="/register-seller" 
                  className="px-8 py-5 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-brand-500/20 hover:scale-[1.03] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <PlusCircle className="w-5 h-5 animate-bounce" />
                  {currentLang === 'pt' ? 'Trazer Minha Loja Grátis' : 'Bring My Shop Here For Free'} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              
              <div className="flex items-center gap-3 text-white font-bold px-6 py-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm text-sm">
                <span className="text-brand-400 text-lg">500+</span> 
                <span>{currentLang === 'pt' ? 'Lojas Ativas em Moçambique' : 'Active Stores in Mozambique'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative z-10 w-full max-w-sm">
             <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 space-y-4 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center text-success-600 font-extrabold text-lg">98%</div>
                  <p className="text-gray-900 font-black text-base leading-tight">
                    {currentLang === 'pt' ? 'Aumento Médio nas Vendas Locais' : 'Average Local Sales Increase'}
                  </p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[98%] bg-success-500"></div>
                </div>
                <div className="pt-4 space-y-3 pt-4">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600 font-semibold">
                    <ShieldCheck className="w-4.5 h-4.5 text-brand-500 flex-shrink-0" />
                    <span>{currentLang === 'pt' ? 'Estatísticas de Visitas Diárias' : 'Daily Visit Proximity Stats'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-600 font-semibold">
                    <MessageSquare className="w-4.5 h-4.5 text-success-500 flex-shrink-0" />
                    <span>{currentLang === 'pt' ? 'Leads de Clientes pelo WhatsApp' : 'Customer Hot Leads via WhatsApp'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-600 font-semibold">
                    <Zap className="w-4.5 h-4.5 text-accent-500 flex-shrink-0" />
                    <span>{currentLang === 'pt' ? 'Registo e Gestão Simplificada' : 'Ultra Simple Stock Catalog Management'}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Featured Sellers */}
      {(!sellersLoading && featuredSellers.length === 0) ? null : (
        <section className="max-w-7xl mx-auto px-4 w-full mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('home.best_sellers')}</h2>
            <Link to="/marketplace" className="text-brand-600 font-semibold text-sm hover:underline">{t('home.view_all_shops')}</Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {sellersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <StoreSkeleton key={i} />
              ))
            ) : (
              featuredSellers.map((seller) => {
                const storeCategory = CATEGORIES.find(c => c.id === seller.category);
                const storeCatLabel = storeCategory 
                  ? (storeCategory.translationKey ? t(storeCategory.translationKey) : storeCategory.name)
                  : (seller.category || '');
                const storeRating = seller.rating || 4.8;

                return (
                  <Link key={seller.id} to={`/store/${seller.id}`} className="bg-white p-5 rounded-3xl border border-gray-100 hover:border-brand-500 hover:shadow-2xl transition-all flex items-center gap-5 group">
                    <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-2xl overflow-hidden shrink-0 border border-gray-100 relative flex items-center justify-center font-black text-2xl uppercase">
                      {seller.logo ? (
                        <img 
                          src={seller.logo} 
                          alt={seller.businessName} 
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        seller.businessName?.charAt(0) || 'S'
                      )}
                      <div className="absolute inset-0 bg-brand-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-extrabold text-gray-900 text-base group-hover:text-brand-600 transition-colors truncate">{seller.businessName}</h3>
                        {seller.isVerified && (
                          <ShieldCheck className="w-4 h-4 text-brand-500 fill-brand-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-brand-600 font-extrabold uppercase tracking-widest mb-2.5 truncate">{storeCatLabel}</p>
                      <div className="flex items-center justify-between gap-2">
                        {seller.location && (
                          <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1 truncate">
                             <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> 
                             <span className="truncate">{seller.location}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                           <Star className="w-3 h-3 text-accent-400 fill-accent-400 animate-pulse" />
                           <span className="text-xs font-black text-gray-800">{storeRating}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
