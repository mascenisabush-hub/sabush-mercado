import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, SlidersHorizontal, Grid, List as ListIcon, Star, PlusCircle, MessageSquare, Store as StoreIcon, Truck, ChevronDown, MapPin, ShoppingBag, X, Wrench, GitCompare } from 'lucide-react';
import { Link, useLocation } from '../components/common/RouteLink';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { Product, Store as StoreType, Promotion } from '../types';
import { formatCurrency, cn, getDistance } from '../lib/utils';
import { useCart } from '../context/CartContext';
import { useCompare } from '../context/CompareContext';
import { useLocation as useUserLocation } from '../context/LocationContext';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import { getTranslatedField } from '../lib/i18nUtils';
import { ProductSkeleton } from '../components/common/Skeleton';
import { SafeImage } from '../components/common/SafeImage';
import { EmptyState } from '../components/common/EmptyState';
import Fuse from 'fuse.js';

export function Marketplace() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Record<string, StoreType>>({});
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'promotions'),
      where('isActive', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const list = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      } as Promotion)).filter(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return now >= start && now <= end;
      });
      setPromotions(list);
    }, (error) => {
      console.error("Error loading promotions in Marketplace:", error);
    });
    return () => unsubscribe();
  }, []);
  const [offeringType, setOfferingType] = useState<'all' | 'product' | 'service'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('Newest');
  const [loading, setLoading] = useState(true);
  const [isWholesaleOnly, setIsWholesaleOnly] = useState(false);
  const [isReadyToShip, setIsReadyToShip] = useState(false);
  const [minStoreRating, setMinStoreRating] = useState<number>(0);
  const [onlyWithDelivery, setOnlyWithDelivery] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000000 });
  
  const { addToCart } = useCart();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const routeLocation = useLocation();
  const { location: userLocation, selectedCountry, requestLocation } = useUserLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) {
      setSelectedCategory(cat);
    } else {
      setSelectedCategory(null);
    }
    
    const search = params.get('search');
    if (search !== null) {
      setSearchQuery(search);
    } else {
      setSearchQuery('');
    }
  }, [routeLocation]);

  useEffect(() => {
    // Attempt to load cached products and stores first for immediate rendering on low-speed internet
    try {
      const cachedProducts = localStorage.getItem(`products_cache_${selectedCountry.code}`);
      const cachedStores = localStorage.getItem('stores_cache');
      if (cachedProducts) {
        setProducts(JSON.parse(cachedProducts));
        setLoading(false); // Display cached items instantly while refreshing from network
      }
      if (cachedStores) {
        setStores(JSON.parse(cachedStores));
      }
    } catch (e) {
      console.error('Failed to parse cached products or stores', e);
    }

    // Fetch products filtered by the selected country
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'active'),
      where('country', '==', selectedCountry.code),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const productList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[];
      setProducts(productList);

      // Save to cache for offline/low internet startup speed
      try {
        localStorage.setItem(`products_cache_${selectedCountry.code}`, JSON.stringify(productList));
      } catch (err) {
        console.error('Failed to save products cache', err);
      }

      // Fetch unique stores for these products
      const storeIds = Array.from(new Set(productList.map(p => p.storeId)));
      const newStores: Record<string, StoreType> = { ...stores };
      
      const missingStoreIds = storeIds.filter(id => !newStores[id]);
      
      if (missingStoreIds.length > 0) {
        // Firestore common pattern for 'in' query with chunks of 10
        for (let i = 0; i < missingStoreIds.length; i += 10) {
          const chunk = missingStoreIds.slice(i, i + 10);
          const sq = query(collection(db, 'stores'), where('__name__', 'in', chunk));
          const sSnapshot = await getDocs(sq);
          sSnapshot.forEach(doc => {
            newStores[doc.id] = { ...doc.data(), id: doc.id } as StoreType;
          });
        }
        setStores(newStores);
        try {
          localStorage.setItem('stores_cache', JSON.stringify(newStores));
        } catch (err) {
          console.error('Failed to save stores cache', err);
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCountry.code]);

  const enrichedProducts = useMemo(() => {
    return products.map(p => {
      const store = stores[p.storeId];
      let distance;
      if (store?.latitude && store?.longitude && userLocation) {
        distance = getDistance(userLocation.latitude, userLocation.longitude, store.latitude, store.longitude);
      }

      const catObj = CATEGORIES.find(c => c.id === p.category);
      const categoryLabel = catObj ? (catObj.translationKey ? t(catObj.translationKey) : catObj.name) : p.category;
      const categoryRawName = catObj?.name || p.category;
      const translatedName = getTranslatedField(p, 'name', p.name);
      const translatedDescription = getTranslatedField(p, 'description', p.description);

      return { 
        ...p, 
        distance, 
        storeName: store?.businessName || 'Loading Store...',
        categoryLabel,
        categoryRawName,
        translatedName,
        translatedDescription
      };
    });
  }, [products, stores, userLocation, t, i18n.language]);

  const filteredCategories = useMemo(() => {
    if (offeringType === 'all') return CATEGORIES;
    return CATEGORIES.filter(cat => cat.type === offeringType);
  }, [offeringType]);

  const suggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const productNames = products.map(p => getTranslatedField(p, 'name', p.name));
    const categoryNames = CATEGORIES.map(c => c.translationKey ? t(c.translationKey) : c.name);
    const combined = Array.from(new Set([...productNames, ...categoryNames]));
    
    const fuse = new Fuse(combined, { threshold: 0.4 });
    return fuse.search(searchQuery).slice(0, 6).map(r => r.item);
  }, [searchQuery, products, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    let result = enrichedProducts;

    if (searchQuery) {
      const fuse = new Fuse(enrichedProducts, {
        keys: [
          { name: 'translatedName', weight: 1.0 },
          { name: 'name', weight: 0.9 },
          { name: 'categoryLabel', weight: 0.6 },
          { name: 'categoryRawName', weight: 0.5 },
          { name: 'category', weight: 0.4 },
          { name: 'translatedDescription', weight: 0.3 },
          { name: 'description', weight: 0.2 },
          { name: 'translations.pt.name', weight: 0.9 },
          { name: 'translations.en.name', weight: 0.9 },
          { name: 'translations.pt.description', weight: 0.2 },
          { name: 'translations.en.description', weight: 0.2 }
        ],
        threshold: 0.35,
        distance: 100,
        ignoreLocation: true
      });
      result = fuse.search(searchQuery).map(r => r.item);
    }

    return result
      .filter(p => !selectedCategory || p.category === selectedCategory)
      .filter(p => {
        if (offeringType === 'all') return true;
        const catObj = CATEGORIES.find(c => c.id === p.category);
        return catObj ? catObj.type === offeringType : (offeringType === 'product');
      })
      .filter(p => !isWholesaleOnly || (p.wholesalePrices && p.wholesalePrices.length > 0))
      .filter(p => !isReadyToShip || p.stock > 0)
      .filter(p => !onlyWithDelivery || p.deliveryAvailable)
      .filter(p => !minStoreRating || (stores[p.storeId]?.rating || 0) >= minStoreRating)
      .filter(p => p.price >= priceRange.min && p.price <= priceRange.max)
      .sort((a, b) => {
        if (sortBy === 'Nearest' && a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (sortBy === 'Price: Low to High') return a.price - b.price;
        if (sortBy === 'Price: High to Low') return b.price - a.price;
        if (sortBy === 'Newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return 0; // Default
      });
  }, [enrichedProducts, selectedCategory, offeringType, searchQuery, sortBy, isWholesaleOnly, isReadyToShip, onlyWithDelivery, minStoreRating, priceRange, stores]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-12 w-48 bg-gray-200 animate-pulse rounded-xl mb-12" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="hidden lg:block space-y-8">
            <div className="h-64 bg-gray-100 animate-pulse rounded-4xl" />
          </div>
          <div className="lg:col-span-3">
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Seller Portal Quick Entry Banner */}
      {user && (isSeller || isAdmin) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-gradient-to-r from-brand-600 to-indigo-750 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 text-xs font-black uppercase tracking-wider rounded-full">{profile?.role === 'admin' ? 'Administrador' : 'Vendedor Registado'}</span>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <h2 className="text-xl font-black tracking-tight pt-1">Painel do Vendedor: Mercado Sabush</h2>
            <p className="text-sm font-medium text-brand-50">Gerencie suas lojas, atualize produtos em tempo real e consulte as vendas efetuadas.</p>
          </div>
          <Link 
            to="/dashboard"
            className="px-6 py-4 bg-white text-brand-600 font-extrabold text-xs uppercase tracking-wider rounded-2xl hover:bg-brand-50 transition-all text-center whitespace-nowrap active:scale-95 shadow-lg border border-white"
          >
            Gestão / Minhas Lojas (My Shops)
          </Link>
        </motion.div>
      )}

      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">{t('marketplace.title')}</h1>
          <p className="text-gray-500 mt-2 font-medium">{t('marketplace.discovering')} <span className="text-blue-600 font-black">{filteredProducts.length} {t('marketplace.unique_items')}</span> {t('marketplace.following_you')}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:w-96" ref={searchRef}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder={t('marketplace.search_placeholder')}
              className="w-full pl-12 pr-12 py-4 bg-white border-2 border-transparent rounded-3xl shadow-xl shadow-blue-50 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
                >
                  <div className="p-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchQuery(suggestion);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-5 py-3 rounded-2xl hover:bg-brand-50 transition-colors flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                          <Search className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-brand-700">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white rounded-3xl font-black text-xs uppercase tracking-widest text-gray-700 hover:bg-gray-50 border border-gray-100 shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-5 h-5" /> {t('marketplace.filters')}
          </button>
        </div>
      </div>

      {/* Offering Selector Tab (Products vs Services) */}
      <div className="flex justify-center mb-10 w-full animate-fade-in">
        <div className="flex p-1.5 bg-gray-100/80 rounded-3xl max-w-lg w-full border border-gray-200/50 shadow-inner">
          <button
            onClick={() => {
              setOfferingType('all');
              setSelectedCategory(null);
            }}
            className={cn(
              "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2",
              offeringType === 'all' ? "bg-white text-gray-900 shadow-md transform scale-[1.01]" : "text-gray-500 hover:text-gray-900"
            )}
            type="button"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>Todos / All</span>
          </button>
          
          <button
            onClick={() => {
              setOfferingType('product');
              setSelectedCategory(null);
            }}
            className={cn(
              "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2",
              offeringType === 'product' ? "bg-white text-brand-600 shadow-md transform scale-[1.01]" : "text-gray-500 hover:text-gray-900"
            )}
            type="button"
          >
            <ShoppingBag className="w-4 h-4 text-brand-500 shrink-0" />
            <span>Produtos / Products</span>
          </button>
          
          <button
            onClick={() => {
              setOfferingType('service');
              setSelectedCategory(null);
            }}
            className={cn(
              "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2",
              offeringType === 'service' ? "bg-white text-indigo-600 shadow-md transform scale-[1.01]" : "text-gray-500 hover:text-gray-900"
            )}
            type="button"
          >
            <Wrench className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Serviços / Services</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Categories with Icons - Highly responsive, optimized for fast browsing on any phone, tablet or desktop */}
      <div className="w-full mb-10 overflow-x-auto pb-4 pt-1 flex gap-3 scrollbar-none select-none -mx-4 px-4 md:mx-0 md:px-0">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "flex items-center gap-2.5 px-6 py-3.5 rounded-full text-xs font-black uppercase tracking-widest shrink-0 transition-all border",
            selectedCategory === null 
              ? "bg-brand-600 text-white border-brand-600 shadow-xl shadow-brand-500/20 scale-[1.03]" 
              : "bg-white text-gray-600 border-gray-100 hover:border-gray-300 hover:text-gray-950 shadow-sm"
          )}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{t('marketplace.all_collections')}</span>
        </button>
        {filteredCategories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon] || ShoppingBag;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3.5 rounded-full text-xs font-black uppercase tracking-widest shrink-0 transition-all border",
                isSelected
                  ? "bg-brand-600 text-white border-brand-600 shadow-xl shadow-brand-500/20 scale-[1.03]"
                  : "bg-white text-gray-600 border-gray-100 hover:border-gray-200 hover:text-gray-950 shadow-sm"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.translationKey ? t(cat.translationKey) : cat.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Categories Sidebar */}
        <aside className={cn("lg:w-72 space-y-8", showFilters ? "block" : "hidden lg:block")}>
          <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center justify-between italic">
               {t('marketplace.explore')}
               <ChevronDown className="w-4 h-4 text-gray-400 lg:hidden" />
            </h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "text-left px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                  selectedCategory === null ? "bg-brand-600 text-white shadow-xl shadow-brand-100" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                {t('marketplace.all_collections')}
              </button>
              {filteredCategories.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "text-left px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-between",
                    selectedCategory === cat.id ? "bg-brand-600 text-white shadow-xl shadow-brand-100" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {cat.translationKey ? t(cat.translationKey) : cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-gray-900 italic">{t('marketplace.market_filters')}</h3>
            
            {!userLocation && (
              <div className="mb-6 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                <p className="text-[10px] font-bold text-brand-800 mb-3 leading-tight tracking-tight uppercase">
                   {t('marketplace.gps_hint')}
                </p>
                <button 
                  onClick={() => requestLocation()}
                  className="w-full py-2 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-brand-700 transition-all"
                >
                  <MapPin className="w-3 h-3" /> {t('marketplace.enable_gps')}
                </button>
              </div>
            )}
            
            <div className="space-y-4">
              <button 
                type="button"
                className="w-full flex items-center gap-3 cursor-pointer group hover:bg-gray-50 p-2 rounded-2xl transition-colors text-left font-sans outline-none focus:ring-2 focus:ring-brand-500/20"
                onClick={() => setIsWholesaleOnly(!isWholesaleOnly)}
              >
                <div 
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative border-2 flex-shrink-0",
                    isWholesaleOnly ? "bg-brand-600 border-brand-600 shadow-brand-500/20" : "bg-gray-200 border-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 shadow-sm",
                    isWholesaleOnly ? "left-6 bg-white" : "left-1 bg-gray-400"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest leading-none transition-colors",
                  isWholesaleOnly ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"
                )}>{t('marketplace.wholesale')}</span>
              </button>

              <button 
                type="button"
                className="w-full flex items-center gap-3 cursor-pointer group hover:bg-gray-50 p-2 rounded-2xl transition-colors text-left font-sans outline-none focus:ring-2 focus:ring-brand-500/20"
                onClick={() => setIsReadyToShip(!isReadyToShip)}
              >
                <div 
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative border-2 flex-shrink-0",
                    isReadyToShip ? "bg-accent-500 border-accent-500 shadow-accent-500/20" : "bg-gray-200 border-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 shadow-sm",
                    isReadyToShip ? "left-6 bg-white" : "left-1 bg-gray-400"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest leading-none transition-colors",
                  isReadyToShip ? "text-accent-500" : "text-gray-400 group-hover:text-gray-600"
                )}>{t('marketplace.ready_to_ship')}</span>
              </button>

              <button 
                type="button"
                className="w-full flex items-center gap-3 cursor-pointer group hover:bg-gray-50 p-2 rounded-2xl transition-colors text-left font-sans outline-none focus:ring-2 focus:ring-brand-500/20"
                onClick={() => setOnlyWithDelivery(!onlyWithDelivery)}
              >
                <div 
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative border-2 flex-shrink-0",
                    onlyWithDelivery ? "bg-success-600 border-success-600 shadow-success-500/20" : "bg-gray-200 border-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 shadow-sm",
                    onlyWithDelivery ? "left-6 bg-white" : "left-1 bg-gray-400"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest leading-none transition-colors",
                  onlyWithDelivery ? "text-success-600" : "text-gray-400 group-hover:text-gray-600"
                )}>{t('marketplace.has_delivery')}</span>
              </button>
            </div>

            <div className="pt-6 border-t border-gray-50 flex flex-col gap-4">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('marketplace.store_rating')}</p>
               <div className="flex flex-col gap-2">
                 {[0, 4, 3, 2].map((rating) => (
                   <button
                    key={rating}
                    onClick={() => setMinStoreRating(rating)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      minStoreRating === rating ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-gray-50"
                    )}
                   >
                     {rating === 0 ? (
                       <span>{t('marketplace.any_rating')}</span>
                     ) : (
                       <div className="flex items-center gap-1.5">
                         <div className="flex items-center gap-0.5">
                           {[...Array(5)].map((_, i) => (
                             <Star 
                               key={i} 
                               className={cn(
                                 "w-3 h-3", 
                                 i < rating ? "text-orange-400 fill-orange-400" : "text-gray-200"
                               )} 
                             />
                           ))}
                         </div>
                         <span>{rating}+ {t('marketplace.and_up')}</span>
                       </div>
                     )}
                   </button>
                 ))}
               </div>
            </div>

            <div className="pt-6 border-t border-gray-50 flex flex-col gap-4">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('marketplace.price_range')} ({selectedCountry.currency})</p>
               <div className="flex items-center gap-2">
                 <input 
                  type="number" 
                  placeholder={t('marketplace.min')}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-1 focus:ring-brand-500 outline-none"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) })}
                 />
                 <span className="text-gray-300">-</span>
                 <input 
                  type="number" 
                  placeholder={t('marketplace.max')}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-1 focus:ring-brand-500 outline-none"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })}
                 />
               </div>
            </div>
            
            <button 
              onClick={() => {
                setIsWholesaleOnly(false);
                setIsReadyToShip(false);
                setOnlyWithDelivery(false);
                setMinStoreRating(0);
                setPriceRange({ min: 0, max: 1000000 });
                setSelectedCategory(null);
              }}
              className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              {t('marketplace.reset_filters')}
            </button>
          </div>

          <div className="bg-gray-900 p-8 rounded-4xl text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-6 opacity-20 rotate-12"><PlusCircle className="w-16 h-16" /></div>
             <h4 className="text-2xl font-black mb-4 italic tracking-tight">{t('marketplace.got_something')}</h4>
             <p className="text-gray-400 text-sm mb-8 font-medium">{t('marketplace.open_store')}</p>
             <Link to="/register-seller" className="block text-center py-4 bg-white text-gray-900 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-50 transition-colors italic">
               {t('marketplace.launch_store')}
             </Link>
          </div>
        </aside>        {/* Product Grid */}
        <section className="flex-1">
          <div className="mb-8 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <button className="p-3 bg-white border border-gray-100 rounded-2xl text-brand-600 shadow-sm"><Grid className="w-6 h-6" /></button>
                <button className="p-3 border border-transparent rounded-2xl text-gray-400 hover:bg-white"><ListIcon className="w-6 h-6" /></button>
             </div>
             <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-400">
                <span>{t('marketplace.sort_by')}:</span>
                <select 
                  className="bg-transparent font-black text-gray-900 border-none focus:ring-0 cursor-pointer uppercase tracking-widest"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="Newest">{t('marketplace.sort_newest')}</option>
                  {userLocation && <option value="Nearest">{t('marketplace.sort_nearest')}</option>}
                  <option value="Price: Low to High">{t('marketplace.sort_price_low')}</option>
                  <option value="Price: High to Low">{t('marketplace.sort_price_high')}</option>
                </select>
             </div>
          </div>          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
            <AnimatePresence>
               {filteredProducts.map((product) => {
                const activePromo = promotions.find(p => p.applicableProductIds.includes(product.id));
                const promoPrice = activePromo ? Math.round(product.price * (1 - activePromo.discountPercentage / 100)) : product.price;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={product.id} 
                    className="bg-white rounded-4xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500"
                  >
                     <Link to={`/product/${product.id}`} className="block relative h-72 overflow-hidden bg-gray-50">
                      <SafeImage 
                        src={product.images[0] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&q=80&w=400'} 
                        alt={getTranslatedField(product, 'name', product.name)} 
                        fallbackText={getTranslatedField(product, 'name', product.name)}
                        fallbackType="product"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      />
                      <div className="absolute top-6 left-6 flex flex-col gap-2">
                        {activePromo && (
                          <div className={cn(
                            "text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-xl border border-white whitespace-nowrap",
                            activePromo.type === 'flash_sale' ? "bg-amber-650 bg-amber-650 bg-amber-500" : "bg-emerald-600"
                          )}>
                            <span>{activePromo.type === 'flash_sale' ? '⚡ RELÂMPAGO' : `🔥 -${activePromo.discountPercentage}%`}</span>
                          </div>
                        )}
                        {product.deliveryAvailable && (
                          <div className="bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-xl border border-white">
                            <Truck className="w-3.5 h-3.5 text-brand-600" /> {t('marketplace.delivery_available')}
                          </div>
                        )}
                        {product.distance !== undefined && (
                          <div className="bg-brand-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-xl whitespace-nowrap">
                            <MapPin className="w-3.5 h-3.5" /> {product.distance.toFixed(1)} {t('marketplace.km_away')}
                          </div>
                        )}
                      </div>

                      {/* Top Right Compare Button Trigger */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isInCompare(product.id)) {
                            removeFromCompare(product.id);
                          } else {
                            addToCompare(product);
                          }
                        }}
                        className={cn(
                          "absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center shadow-xl backdrop-blur-md transition-all z-10 cursor-pointer border",
                          isInCompare(product.id) 
                            ? "bg-brand-600 border-brand-600 text-white hover:bg-brand-700" 
                            : "bg-white/90 border-white text-gray-500 hover:text-brand-600 hover:scale-110"
                        )}
                        title="Comparar Produto side-by-side"
                      >
                        <GitCompare className="w-4.5 h-4.5" />
                      </button>
                     </Link>

                     <div className="p-8">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] text-brand-600 font-extrabold uppercase tracking-[0.2em]">
                          {CATEGORIES.find(c => c.id === product.category)?.translationKey ? t(CATEGORIES.find(c => c.id === product.category)!.translationKey!) : product.category}
                        </p>
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                          <span className="text-[10px] font-black text-gray-900">{product.rating}</span>
                        </div>
                      </div>

                      <Link to={`/product/${product.id}`}>
                        <h3 className="font-black text-gray-900 text-xl mb-2 hover:text-brand-600 transition-colors line-clamp-1 italic tracking-tight">{getTranslatedField(product, 'name', product.name)}</h3>
                      </Link>
                      
                      <p className="text-gray-400 text-sm mb-8 line-clamp-2 min-h-[40px] font-medium leading-relaxed">{getTranslatedField(product, 'description', product.description)}</p>

                      <div className="flex items-center justify-between">
                        <div>
                          {activePromo ? (
                            <div className="flex flex-col text-left">
                              <span className="text-[11px] font-black text-gray-400 line-through leading-none block mb-1">
                                {formatCurrency(product.price, product.currency || selectedCountry.currency).split(',')[0]}
                              </span>
                              <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">
                                {formatCurrency(promoPrice, product.currency || selectedCountry.currency).split(',')[0]}
                                <span className="text-[10px] font-bold uppercase tracking-widest ml-1 text-gray-400">{product.currency || selectedCountry.currency}</span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-3xl font-black text-gray-900 tracking-tighter leading-none text-left">
                              {formatCurrency(product.price, product.currency || selectedCountry.currency).split(',')[0]} 
                              <span className="text-xs font-bold uppercase tracking-widest ml-1 opacity-40">{product.currency || selectedCountry.currency}</span>
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => addToCart(product)}
                          className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center hover:bg-brand-600 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-gray-200 group/btn"
                        >
                          <PlusCircle className="w-8 h-8 group-hover/btn:rotate-90 transition-transform" />
                        </button>
                      </div>

                      <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                        <Link to={`/store/${product.storeId}`} className="flex items-center gap-3 group/store">
                          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 text-[10px] font-black group-hover/store:bg-brand-600 group-hover/store:text-white transition-all overflow-hidden">
                            <SafeImage 
                              src={stores[product.storeId]?.logo} 
                              alt="" 
                              fallbackText={product.storeName}
                              fallbackType="store"
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div>
                             <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{t('marketplace.seller_label')}</p>
                             <p className="text-xs font-black text-gray-900 group-hover/store:text-brand-600 transition-colors line-clamp-1">{product.storeName}</p>
                          </div>
                        </Link>
                        <a href={`https://wa.me/${stores[product.storeId]?.whatsappNumber || '258XXXXXXXXX'}?text=Hi, I'm interested in: ${getTranslatedField(product, 'name', product.name)}`} className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center hover:bg-green-600 hover:text-white transition-all">
                          <MessageSquare className="w-5 h-5" />
                        </a>
                      </div>
                     </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredProducts.length === 0 && (
            <div className="mt-12 bg-white rounded-4xl p-12 border border-gray-100 shadow-sm flex items-center justify-center">
               <div className="w-full">
                  <EmptyState
                    icon={ShoppingBag}
                    title={t('marketplace.no_treasures')}
                    description={t('marketplace.no_results_desc')}
                    ctaText={t('marketplace.clear_all')}
                    onCtaClick={() => { setSelectedCategory(null); setSearchQuery(''); }}
                  />
               </div>
               
               
               <button 
                 className="hidden"
               >
                 {t('marketplace.clear_all')}
               </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
