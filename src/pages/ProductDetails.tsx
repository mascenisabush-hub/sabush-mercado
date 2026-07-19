import React, { useState, useEffect, useRef } from 'react';
import { Star, Truck, ShieldCheck, Heart, Share2, MessageSquare, ShoppingCart, Minus, Plus, ArrowLeft, ChevronLeft, ChevronRight, Store, MessageCircle, Flag, AlertCircle, GitCompare, CheckCircle2, TrendingDown } from 'lucide-react';
import { Link, useNavigate } from '../components/common/RouteLink';
import { formatCurrency, cn } from '../lib/utils';
import { useCart } from '../context/CartContext';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useCompare } from '../context/CompareContext';
import { motion, AnimatePresence } from 'motion/react';
import { ReportModal } from '../components/modals/ReportModal';
import { RFQModal } from '../components/modals/RFQModal';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot, query, where, collection, addDoc, deleteDoc, getDocs, limit, updateDoc, increment } from 'firebase/firestore';
import { Product, Store as StoreType, Promotion } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { getTranslatedField } from '../lib/i18nUtils';
import { CATEGORIES } from '../constants';
import { Skeleton } from '../components/common/Skeleton';
import { SafeImage } from '../components/common/SafeImage';
import { ProductReviews } from '../components/common/Reviews';
import { ProductQAs } from '../components/common/ProductQAs';
import { calculateStoreChatStats, calculateStoreOrderStats } from '../lib/trustSignals';
import { EmptyState } from '../components/common/EmptyState';

import { useLocation as useAppLocation } from '../context/LocationContext';

export function ProductDetails({ id }: { id: string }) {
  const { t } = useTranslation();
  const { selectedCountry } = useAppLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<StoreType | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRFQModalOpen, setIsRFQModalOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const { startChatWithSeller } = useChat();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [timeLeft, setTimeLeft] = useState('');

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
      console.error("Error loading promotions in ProductDetails:", error);
    });
    return () => unsubscribe();
  }, []);

  const activePromo = product ? promotions.find(p => p.applicableProductIds.includes(product.id)) : undefined;

  useEffect(() => {
    if (!activePromo || activePromo.type !== 'flash_sale') {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const difference = new Date(activePromo.endDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft('Expired');
      } else {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60);
        const s = Math.floor((difference / 1000) % 60);
        
        setTimeLeft(d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}:${pad(m)}:${pad(s)}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activePromo]);

  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({
    transform: 'scale(1)',
    transformOrigin: 'center'
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(1.8)',
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({
      transformOrigin: 'center',
      transform: 'scale(1)',
    });
  };
  const { user } = useAuth();
  const navigate = useNavigate();

  const [storeRecs, setStoreRecs] = useState<Product[]>([]);
  const [storeRecsLoading, setStoreRecsLoading] = useState(true);
  const [relatedRecs, setRelatedRecs] = useState<Product[]>([]);
  const [relatedRecsLoading, setRelatedRecsLoading] = useState(true);
  const storeCarouselRef = useRef<HTMLDivElement>(null);
  const relatedCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!product?.id) return;
    setStoreRecsLoading(true);
    setRelatedRecsLoading(true);

    const fetchStoreRecs = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('storeId', '==', product.storeId),
          where('status', '==', 'active'),
          limit(12)
        );
        const snap = await getDocs(q);
        const items: Product[] = [];
        snap.forEach(docSnap => {
          const item = { ...docSnap.data(), id: docSnap.id } as Product;
          if (item.id !== product.id) {
            items.push(item);
          }
        });
        setStoreRecs(items.slice(0, 6)); // 4-6 products
      } catch (err) {
        console.error("Failed to fetch store recs:", err);
      } finally {
        setStoreRecsLoading(false);
      }
    };

    const fetchRelatedRecs = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('category', '==', product.category),
          where('status', '==', 'active'),
          limit(16)
        );
        const snap = await getDocs(q);
        const items: Product[] = [];
        snap.forEach(docSnap => {
          const item = { ...docSnap.data(), id: docSnap.id } as Product;
          // same category, different store, excluding current product
          if (item.id !== product.id && item.storeId !== product.storeId) {
            items.push(item);
          }
        });

        // Fallback to same category, same store (excluding current product) if we don't have enough different store items
        if (items.length < 4) {
          snap.forEach(docSnap => {
            const item = { ...docSnap.data(), id: docSnap.id } as Product;
            if (item.id !== product.id && item.storeId === product.storeId) {
              if (!items.some(i => i.id === item.id)) {
                items.push(item);
              }
            }
          });
        }

        setRelatedRecs(items.slice(0, 8)); // 4-8 products
      } catch (err) {
        console.error("Failed to fetch related recs:", err);
      } finally {
        setRelatedRecsLoading(false);
      }
    };

    fetchStoreRecs();
    fetchRelatedRecs();
  }, [product?.id, product?.category, product?.storeId]);

  const scrollStoreCarousel = (direction: 'left' | 'right') => {
    if (storeCarouselRef.current) {
      const { scrollLeft, clientWidth } = storeCarouselRef.current;
      const scrollOffset = clientWidth * 0.75;
      storeCarouselRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollOffset : scrollLeft + scrollOffset,
        behavior: 'smooth'
      });
    }
  };

  const scrollRelatedCarousel = (direction: 'left' | 'right') => {
    if (relatedCarouselRef.current) {
      const { scrollLeft, clientWidth } = relatedCarouselRef.current;
      const scrollOffset = clientWidth * 0.75;
      relatedCarouselRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollOffset : scrollLeft + scrollOffset,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (!id) return;
    const incrementViews = async () => {
      try {
        await updateDoc(doc(db, 'products', id), {
          views: increment(1)
        });
      } catch (err) {
        console.error("Failed to increment views:", err);
      }
    };
    incrementViews();
  }, [id]);

  useEffect(() => {
    setLoading(true);
    window.scrollTo(0, 0);
    const unsubscribe = onSnapshot(doc(db, 'products', id), async (docSnap) => {
      if (docSnap.exists()) {
        const productData = { ...docSnap.data(), id: docSnap.id } as Product;
        setProduct(productData);
        setQuantity(productData.minOrderQuantity || 1);
        
        // Fetch store info
        const storeSnap = await getDoc(doc(db, 'stores', productData.storeId));
        if (storeSnap.exists()) {
          const storeData = { ...storeSnap.data(), id: storeSnap.id } as StoreType;
          
          // Compute live metrics
          const chatStats = await calculateStoreChatStats(storeData.ownerId);
          const orderStats = await calculateStoreOrderStats(productData.storeId);
          
          setStore({
            ...storeData,
            responseRate: storeData.responseRate !== undefined ? storeData.responseRate : chatStats.responseRate,
            averageResponseTime: storeData.averageResponseTime !== undefined ? storeData.averageResponseTime : chatStats.averageResponseTimeText,
            fulfillmentRate: storeData.fulfillmentRate !== undefined ? storeData.fulfillmentRate : orderStats.fulfillmentRate,
            totalSales: storeData.totalSales !== undefined ? storeData.totalSales : orderStats.totalSales
          });
        }
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `products/${id}`));

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid), where('productId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsFavorited(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [user, id]);

  useEffect(() => {
    if (store?.whatsappNumber && product) {
      const productName = getTranslatedField(product, 'name', product.name);
      const storeName = store.businessName || 'Dono da Loja';
      window.dispatchEvent(
        new CustomEvent('sabush:whatsapp:update', {
          detail: {
            number: store.whatsappNumber,
            message: `Olá, ${storeName}! Vi o produto "${productName}" no Mercado Sabush (${window.location.href}) e gostava de falar consigo.`,
            name: storeName
          }
        })
      );
    }
  }, [store, product]);

  // Track Recently Viewed Products
  useEffect(() => {
    if (product) {
      const storeName = store?.businessName || 'Dono da Loja';
      try {
        const raw = localStorage.getItem('sabush:recently-viewed');
        let list: any[] = [];
        try {
          list = raw ? JSON.parse(raw) : [];
        } catch (e) {
          list = [];
        }
        
        // Filter out existing occurrence of this product to avoid duplicates
        list = list.filter((item: any) => item.product?.id !== product.id);
        
        // Insert at the beginning (most recent)
        list.unshift({
          product,
          storeName,
          viewedAt: new Date().toISOString()
        });
        
        // Limit to maximum 12 items for clean visual rendering on mobile/desktop
        list = list.slice(0, 12);
        
        localStorage.setItem('sabush:recently-viewed', JSON.stringify(list));
      } catch (err) {
        console.warn("Could not save recently viewed item to localStorage:", err);
      }
    }
  }, [product, store]);

  // Dynamic Document Title and Open Graph Meta Tags for Product Page
  useEffect(() => {
    if (!product) return;

    const prevTitle = document.title;
    const productName = getTranslatedField(product, 'name', product.name);
    const promoPrice = activePromo ? Math.round(product.price * (1 - activePromo.discountPercentage / 100)) : product.price;
    const priceText = formatCurrency(promoPrice);
    const newTitle = `${productName} - ${priceText} | Mercado Sabush`;
    document.title = newTitle;

    const updateMetaTag = (property: string, content: string, attrName = 'property') => {
      let element = document.querySelector(`meta[${attrName}="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const description = getTranslatedField(product, 'description', product.description) || '';
    const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800';
    const currentUrl = window.location.href;

    updateMetaTag('og:title', newTitle);
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', mainImage);
    updateMetaTag('og:url', currentUrl);
    updateMetaTag('og:type', 'product');

    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', newTitle, 'name');
    updateMetaTag('twitter:description', description, 'name');
    updateMetaTag('twitter:image', mainImage, 'name');

    return () => {
      document.title = prevTitle;
    };
  }, [product, activePromo, t]);

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/login?redirect=product/' + id);
      return;
    }
    try {
      if (isFavorited) {
        const q = query(collection(db, 'favorites'), where('userId', '==', user.uid), where('productId', '==', id));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, 'favorites', d.id)));
      } else {
        await addDoc(collection(db, 'favorites'), {
          userId: user.uid,
          productId: id,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Favorite toggle error:", error);
    }
  };

  const handleLiveChat = async () => {
    if (!user) {
      navigate('/login?redirect=product/' + id);
      return;
    }
    if (!product) return;
    try {
      const sellerId = product.sellerId; 
      await startChatWithSeller(sellerId);
    } catch (error) {
      console.error("Chat error:", error);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    const productName = getTranslatedField(product, 'name', product.name);
    const productDesc = getTranslatedField(product, 'description', product.description) || '';
    // Strip HTML/rich markdown tags if any, and grab a neat summary snippet
    const cleanDesc = productDesc.replace(/<[^>]*>?/gm, '').substring(0, 100).trim();
    
    const shareData = {
      title: productName,
      text: `${productName}\n${cleanDesc ? cleanDesc + '...' : ''}\n`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return; // Native system share menu handled it
      } catch (err) {
        // Cancelled by user is a normal interaction, not an error
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.warn('Web Share failed, attempting fallback copy:', err);
      }
    }

    // Fallback: Clipboard text copying
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const originalBasePrice = product?.wholesalePrices 
    ? (product.wholesalePrices.filter(t => quantity >= t.minQuantity).sort((a,b) => b.minQuantity - a.minQuantity)[0]?.price || product.price)
    : product?.price || 0;

  const currentPrice = activePromo 
    ? Math.round(originalBasePrice * (1 - activePromo.discountPercentage / 100))
    : originalBasePrice;

  const totalPrice = currentPrice * quantity;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-6 w-24 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-6 sm:p-10 rounded-[40px] border border-gray-100 shadow-sm">
          <Skeleton className="aspect-square w-full rounded-[32px]" />
          <div className="space-y-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-14 flex-1 rounded-2xl" />
              <Skeleton className="h-14 flex-1 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title="Product not found"
          description="The product you are looking for does not exist or has been removed."
          ctaText="Return to Marketplace"
          ctaLink="/marketplace"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/marketplace')} className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors">
         <ArrowLeft className="w-5 h-5" /> {t('common.back')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-6 sm:p-10 rounded-[40px] border border-gray-100 shadow-sm">
        {/* Gallery */}
        <div className="space-y-6">
          <motion.div 
            layoutId={`prod-img-${product.id}`}
            className="aspect-square rounded-[32px] overflow-hidden bg-gray-50 border border-gray-100 relative group cursor-zoom-in"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <SafeImage 
              src={product.images[activeImage] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&q=80&w=800'} 
              alt={getTranslatedField(product, 'name', product.name)} 
              fallbackText={getTranslatedField(product, 'name', product.name)}
              fallbackType="product"
              className="w-full h-full object-cover"
              style={{
                ...zoomStyle,
                transition: zoomStyle.transform === 'scale(1)' ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform-origin 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
              }}
            />
            
            {/* Hover to Zoom indicator badge */}
            <div className="absolute top-6 right-6 pointer-events-none bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-100 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                <span>🔍</span>
                <span>{t('common.hover_zoom', 'Zoom')}</span>
              </span>
            </div>

            {product.minOrderQuantity > 1 && (
               <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest italic">{t('b2b.min_order')}: {product.minOrderQuantity} units</p>
               </div>
            )}
          </motion.div>
          <div className="flex gap-4">
            {product.images.map((img, i) => (
              <button 
                key={i} 
                onClick={() => setActiveImage(i)}
                className={cn(
                  "w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all",
                  activeImage === i ? "border-blue-600 scale-105" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <SafeImage src={img} alt="" fallbackType="product" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest leading-none">
                {CATEGORIES.find(c => c.id === product.category)?.translationKey ? t(CATEGORIES.find(c => c.id === product.category)!.translationKey!) : product.category}
              </span>
              {product.wholesalePrices && (
                <span className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-full text-xs font-black uppercase tracking-widest leading-none border border-orange-100">
                  {t('b2b.wholesale')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
               <button 
                onClick={() => {
                  if (isInCompare(product.id)) {
                    removeFromCompare(product.id);
                  } else {
                    addToCompare(product);
                  }
                }}
                className={cn("transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-100 cursor-pointer shadow-sm hover:scale-105 active:scale-95", 
                  isInCompare(product.id) ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-400 hover:text-blue-600 hover:border-blue-100")}
                title={isInCompare(product.id) ? "Remover do comparador side-by-side" : "Adicionar ao comparador side-by-side"}
               >
                <GitCompare className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider hidden xs:inline">{isInCompare(product.id) ? "Comparando" : "Comparar"}</span>
               </button>
               <button 
                onClick={toggleFavorite}
                className={cn("transition-colors cursor-pointer", isFavorited ? "text-red-500 fill-red-500" : "text-gray-300 hover:text-red-500")}
               >
                 <Heart className="w-6 h-6" />
               </button>
               <button 
                 onClick={handleShare} 
                 className="transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-100 cursor-pointer shadow-sm hover:scale-105 active:scale-95 text-gray-400 hover:text-blue-600 hover:border-blue-100" 
                 title={t('common.share', 'Share')}
               >
                 <Share2 className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-wider hidden xs:inline">{t('common.share', 'Share')}</span>
               </button>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-4">
            {getTranslatedField(product, 'name', product.name)}
          </h1>

          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <Star className="w-5 h-5 text-orange-400 fill-orange-400" />
              <span className="font-black text-gray-900">{product.rating}</span>
              <span className="text-sm text-gray-400 font-medium">({product.reviewCount} reviews)</span>
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
               <ShieldCheck className="w-4 h-4" /> Verified Quality
            </div>
          </div>

          {product.wholesalePrices && (
            <div className="mb-6 space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{t('b2b.bulk_pricing')}</p>
              <div className="flex gap-2">
                {product.wholesalePrices.map((tier, idx) => (
                  <div key={idx} className="flex-1 p-3 bg-blue-50/50 rounded-2xl border border-blue-100 text-center">
                    <p className="text-xs font-black text-gray-900">{tier.minQuantity}+</p>
                    <p className="text-[10px] font-bold text-blue-600">{formatCurrency(tier.price).split(',')[0]} MZN</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6 mb-8 mt-2">
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('common.color')}</p>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 transition-all p-0.5",
                        selectedColor === color ? "border-blue-600 scale-110" : "border-transparent hover:border-gray-200"
                      )}
                    >
                      <div 
                        className="w-full h-full rounded-full border border-black/5"
                        style={{ backgroundColor: color.toLowerCase() }} 
                        title={color}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t('common.size')}</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "min-w-12 h-10 px-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center",
                        selectedSize === size 
                          ? "border-blue-600 bg-blue-50 text-blue-600" 
                          : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activePromo && (
            <div className="bg-emerald-50/70 border border-emerald-100 p-4 sm:p-5 rounded-3xl mb-6 space-y-2 text-left">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-wider italic">
                    PROMOÇÃO: {activePromo.label}
                  </p>
                </div>
                {activePromo.type === 'flash_sale' && timeLeft && (
                  <div className="bg-amber-100 text-amber-900 font-black px-3 py-1 rounded-xl text-[10px] tracking-widest flex items-center gap-1.5 shrink-0 border border-amber-200">
                    <span>⚡ TERMINA EM:</span>
                    <span className="font-mono">{timeLeft}</span>
                  </div>
                )}
              </div>
              <p className="text-[10.5px] text-emerald-700 font-black italic">
                Desconto exclusivo de {activePromo.discountPercentage}% OFF já aplicado automaticamente no preço anunciado abaixo!
              </p>
            </div>
          )}

          <div className="bg-gray-50 p-6 rounded-3xl mb-8 flex items-center justify-between">
             <div>
               <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">Total Price</p>
               <div className="flex items-baseline gap-2 flex-wrap mb-1">
                 {activePromo ? (
                   <>
                     <p className="text-4xl font-black text-emerald-600 leading-none">
                       {formatCurrency(totalPrice, product.currency || selectedCountry.currency).split(',')[0]}
                     </p>
                     <p className="text-lg font-black text-gray-400 line-through leading-none">
                       {formatCurrency(originalBasePrice * quantity, product.currency || selectedCountry.currency).split(',')[0]}
                     </p>
                   </>
                 ) : (
                   <p className="text-4xl font-black text-gray-900 leading-none">
                     {formatCurrency(totalPrice, product.currency || selectedCountry.currency).split(',')[0]}
                   </p>
                 )}
                 <span className="text-sm font-bold text-gray-450">{product.currency || selectedCountry.currency}</span>
               </div>
               {quantity > 1 && (
                 <p className="text-[10.5px] font-bold text-blue-600 leading-normal italic">
                   {formatCurrency(currentPrice, product.currency || selectedCountry.currency)} per unit
                   {activePromo && <span className="text-gray-400 line-through ml-1.5 font-normal">({formatCurrency(originalBasePrice, product.currency || selectedCountry.currency)} original)</span>}
                 </p>
               )}
               {product.priceHistory && product.priceHistory.length > 0 && (
                 <div className="mt-3 flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50/55 border border-green-200 px-3 py-1 rounded-xl w-fit">
                   <TrendingDown className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                   <span>
                     {Math.min(...product.priceHistory.map(h => h.price)) > product.price 
                       ? 'Lowest price in 30 days' 
                       : 'Price dropped recently'}
                   </span>
                 </div>
               )}
             </div>
             <div className="flex items-center bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <button 
                  onClick={() => setQuantity(Math.max(product.minOrderQuantity || 1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 disabled:opacity-30"
                  disabled={quantity <= (product.minOrderQuantity || 1)}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="w-10 text-center font-black text-gray-900">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                </button>
             </div>
          </div>

          <AnimatePresence>
            {errorFeedback && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="mb-4 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold leading-tight flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorFeedback}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-4 mb-4">
             <button 
               onClick={() => {
                 setErrorFeedback(null);
                 if (product.colors?.length && !selectedColor) {
                   setErrorFeedback(t('common.select_color', 'Please select a color'));
                   return;
                 }
                 if (product.sizes?.length && !selectedSize) {
                   setErrorFeedback(t('common.select_size', 'Please select a size'));
                   return;
                 }
                 addToCart(product as any, quantity, selectedColor || undefined, selectedSize || undefined);
                 setShowSuccessToast(true);
                 setIsAdding(true);
                 setTimeout(() => {
                   setIsAdding(false);
                 }, 2000);
               }}
               className={cn(
                 "flex-1 py-5 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl",
                 isAdding 
                   ? "bg-green-600 hover:bg-green-700 shadow-green-100 scale-95" 
                   : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
               )}
               disabled={isAdding}
             >
                <ShoppingCart className="w-6 h-6 animate-pulse" />
                {isAdding ? "Added! ✓" : "Add to Cart"}
             </button>
             <button
               onClick={() => setIsRFQModalOpen(true)}
               className="flex-1 py-5 bg-orange-600 text-white border border-orange-500 rounded-2xl font-black hover:bg-orange-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-100"
             >
                <Flag className="w-6 h-6" /> {t('b2b.get_quote')}
             </button>
          </div>

          {!user && (
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-6 bg-gray-50 py-2 rounded-xl border border-gray-100">
              💡 {t('auth.signin_recommend', 'Sign in for better order tracking & history')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
               onClick={handleLiveChat}
               className="py-5 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl font-black hover:bg-blue-100 transition-all flex items-center justify-center gap-3 shadow-sm"
             >
                <MessageCircle className="w-6 h-6" /> Chat with Supplier
             </button>
             <a 
               href={`https://wa.me/${store?.whatsappNumber}?text=Interested in buying ${product.name}`}
               target="_blank"
               rel="noopener noreferrer"
               className="py-5 bg-green-500 text-white rounded-2xl font-black hover:bg-green-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-100"
             >
                <MessageSquare className="w-6 h-6" /> Contact on WA
             </a>
          </div>

          <div className="space-y-4 mb-8">
             <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100">
                <Truck className="w-5 h-5" />
                <p className="text-sm font-bold">Delivery inside Maputo available within 24 hours.</p>
             </div>
             <div className="flex items-center gap-3 p-4 bg-gray-50 text-gray-600 rounded-2xl border border-gray-100">
                <Store className="w-5 h-5 text-blue-500" />
                <p className="text-sm font-bold">In stock: <span className="text-gray-900 font-black">{product.unitCxStock !== undefined || product.unitEmbStock !== undefined || product.unitUnStock !== undefined ? (
                  [
                    product.unitCxStock ? `${product.unitCxStock} Cx` : null,
                    product.unitEmbStock ? `${product.unitEmbStock} Emb` : null,
                    (product.unitUnStock || (!product.unitCxStock && !product.unitEmbStock)) ? `${product.unitUnStock || 0} Un` : null
                  ].filter(Boolean).join(' + ')
                ) : (
                  `${product.stock} items`
                )}</span> remaining.</p>
             </div>
          </div>

          <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
             <div>
               <h3 className="font-black text-gray-900 text-lg mb-4">Store Information</h3>
               <Link to={`/store/${product.storeId}`} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl overflow-hidden">
                      {store?.logo ? <img src={store.logo} className="w-full h-full object-cover" loading="lazy" /> : store?.businessName?.[0] || 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        {store?.businessName || 'Loading Store...'}
                        {store?.isVerifiedBusiness && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-50" />
                        )}
                      </h4>
                      {store ? (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-gray-500 font-bold">
                          <span className="flex items-center gap-1">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              (store.responseRate || 100) > 80 ? "bg-emerald-500" : (store.responseRate || 100) >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )} />
                            {(store.responseRate !== undefined ? store.responseRate : 100)}% Response
                          </span>
                          <span className="w-1 h-1 bg-gray-350 rounded-full shrink-0" />
                          <span className="text-gray-400 font-medium">{store.averageResponseTime || 'Replies in a few hours'}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Verified Platinum Seller</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
               </Link>
             </div>
             <button 
               onClick={() => setIsReportModalOpen(true)}
               className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors self-end pb-1"
             >
               <Flag className="w-4 h-4" /> Report
             </button>
          </div>
        </div>
      </div>

      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        targetId={id}
        targetType="product"
      />

      <RFQModal 
        isOpen={isRFQModalOpen}
        onClose={() => setIsRFQModalOpen(false)}
        product={product}
      />

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-8 z-50 max-w-sm w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(37,99,235,0.15)] border border-blue-50/50 p-5 flex gap-4 items-start"
          >
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 flex-shrink-0 animate-bounce">
               <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-gray-900 text-sm mb-1">{t('common.added_to_cart', 'Added to Cart')}</h4>
              <p className="text-xs text-gray-400 font-bold mb-3 uppercase tracking-wider">{quantity}x {getTranslatedField(product, 'name', product.name)}</p>
              <div className="flex items-center gap-2">
                <Link
                  to="/cart"
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all text-center flex-1 shadow-md shadow-blue-100"
                >
                  {t('common.view_cart', 'View Cart')}
                </Link>
                <button
                  onClick={() => setShowSuccessToast(false)}
                  className="px-4 py-2.5 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 hover:text-gray-700 transition-all text-center flex-1"
                >
                  {t('common.dismiss', 'Dismiss')}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-8 z-50 max-w-sm w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(37,99,235,0.15)] border border-blue-50/50 p-5 flex gap-4 items-start"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
               <Share2 className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-gray-900 text-sm mb-1">{t('common.link_copied', 'Link Copied!')}</h4>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                {t('common.url_copied_desc', 'Product URL has been copied to your clipboard.')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-12">
         <div className="md:col-span-2 space-y-8">
            <section>
              <h3 className="text-2xl font-black text-gray-900 mb-6">Product Description</h3>
              <p className="text-gray-600 leading-relaxed text-lg">{getTranslatedField(product, 'description', product.description)}</p>
            </section>
            
            <section className="pt-12 border-t border-gray-100">
               <ProductReviews productId={id} />
               <ProductQAs productId={id} storeId={product.storeId} storeName={store?.businessName || 'Vendedor'} />
            </section>
            
            <section>
              <h3 className="text-2xl font-black text-gray-900 mb-6">Specifications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {product.specs?.map((spec, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100">
                      <span className="text-gray-500 font-medium">{spec.name}</span>
                      <span className="text-gray-900 font-bold">{spec.value}</span>
                   </div>
                ))}
                {!product.specs?.length && (
                  <p className="text-gray-500 italic font-medium">No technical specifications provided for this product.</p>
                )}
              </div>
            </section>
         </div>
         
         <div>
            <h3 className="text-2xl font-black text-gray-900 mb-6">Related Products</h3>
            <div className="space-y-6">
              {[1,2,3].map(i => (
                 <Link key={i} to={`/product/${i}`} className="flex items-center gap-4 group">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                       <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=200`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">Related Smartphone Elite</h4>
                       <p className="font-black text-blue-600 text-sm">45,000 MZN</p>
                    </div>
                 </Link>
              ))}
            </div>
         </div>
      </div>

      {/* More from this store Section */}
      {(storeRecsLoading || storeRecs.length > 0) && (
        <section className="mt-16 pt-16 border-t border-gray-100 pb-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] sm:text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-2">
                {t('marketplace.more_from_store_subtitle', 'Do mesmo vendedor // From the same seller')}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight italic">
                {t('marketplace.more_from_this_store', 'Mais desta loja')}
              </h2>
            </div>
            
            {!storeRecsLoading && storeRecs.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => scrollStoreCarousel('left')}
                  className="w-12 h-12 rounded-full border border-gray-100 bg-white flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-100 hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollStoreCarousel('right')}
                  className="w-12 h-12 rounded-full border border-gray-100 bg-white flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-100 hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {storeRecsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-[32px] border border-gray-100 p-4 space-y-4">
                  <Skeleton className="h-44 w-full rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={storeCarouselRef}
              className="flex gap-6 overflow-x-auto pb-6 scrollbar-none snap-x snap-mandatory scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {storeRecs.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="min-w-[280px] sm:min-w-[320px] max-w-[320px] bg-white rounded-[32px] border border-gray-100 overflow-hidden group hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col snap-start"
                >
                  {/* Image Gallery Header */}
                  <Link to={`/product/${item.id}`} className="block relative h-56 overflow-hidden bg-gray-50">
                    <SafeImage
                      src={item.images[0] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&q=80&w=400'}
                      alt={getTranslatedField(item, 'name', item.name)}
                      fallbackText={getTranslatedField(item, 'name', item.name)}
                      fallbackType="product"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {item.deliveryAvailable && (
                        <div className="bg-white/90 backdrop-blur-md text-gray-900 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm border border-white">
                          <Truck className="w-3 h-3 text-brand-600" /> {t('marketplace.delivery_available', 'Entrega')}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                      <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                      <span className="text-[10px] font-black text-gray-900">{item.rating}</span>
                    </div>
                  </Link>

                  {/* Card Content */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-brand-600 font-extrabold uppercase tracking-widest mb-1">
                        {CATEGORIES.find(c => c.id === item.category)?.translationKey 
                          ? t(CATEGORIES.find(c => c.id === item.category)!.translationKey!) 
                          : item.category}
                      </p>
                      <Link to={`/product/${item.id}`}>
                        <h3 className="font-black text-gray-900 text-lg mb-2 hover:text-brand-600 transition-colors line-clamp-1 italic tracking-tight font-sans">
                          {getTranslatedField(item, 'name', item.name)}
                        </h3>
                      </Link>
                      <p className="text-gray-400 text-xs line-clamp-2 min-h-[32px] font-medium leading-relaxed mb-4">
                        {getTranslatedField(item, 'description', item.description)}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">{t('common.price', 'Preço')}</p>
                        <p className="text-xl font-black text-gray-950 tracking-tight">
                          {formatCurrency(item.price, item.currency || selectedCountry.currency).split(',')[0]}
                          <span className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-40">{item.currency || selectedCountry.currency}</span>
                        </p>
                      </div>

                      <Link
                        to={`/product/${item.id}`}
                        className="px-4 py-2.5 bg-brand-50 hover:bg-brand-600 text-brand-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center cursor-pointer shadow-sm border border-brand-100/50 hover:border-brand-600"
                      >
                        {t('common.view_details', 'Ver')}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Related Products Section */}
      {(relatedRecsLoading || relatedRecs.length > 0) && (
        <section className="mt-16 pt-16 border-t border-gray-100 pb-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] sm:text-xs font-black text-brand-600 uppercase tracking-[0.2em] mb-2">
                {t('marketplace.recommendations_subtitle', 'Recomendado para si // Curated for you')}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight italic">
                {t('marketplace.you_might_also_like', 'Poderá gostar também')}
              </h2>
            </div>
            
            {!relatedRecsLoading && relatedRecs.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => scrollRelatedCarousel('left')}
                  className="w-12 h-12 rounded-full border border-gray-100 bg-white flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-100 hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollRelatedCarousel('right')}
                  className="w-12 h-12 rounded-full border border-gray-100 bg-white flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-100 hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {relatedRecsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-[32px] border border-gray-100 p-4 space-y-4">
                  <Skeleton className="h-44 w-full rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={relatedCarouselRef}
              className="flex gap-6 overflow-x-auto pb-6 scrollbar-none snap-x snap-mandatory scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {relatedRecs.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="min-w-[280px] sm:min-w-[320px] max-w-[320px] bg-white rounded-[32px] border border-gray-100 overflow-hidden group hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col snap-start"
                >
                  {/* Image Gallery Header */}
                  <Link to={`/product/${item.id}`} className="block relative h-56 overflow-hidden bg-gray-50">
                    <SafeImage
                      src={item.images[0] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&q=80&w=400'}
                      alt={getTranslatedField(item, 'name', item.name)}
                      fallbackText={getTranslatedField(item, 'name', item.name)}
                      fallbackType="product"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {item.deliveryAvailable && (
                        <div className="bg-white/90 backdrop-blur-md text-gray-900 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm border border-white">
                          <Truck className="w-3 h-3 text-brand-600" /> {t('marketplace.delivery_available', 'Entrega')}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                      <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                      <span className="text-[10px] font-black text-gray-900">{item.rating}</span>
                    </div>
                  </Link>

                  {/* Card Content */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-brand-600 font-extrabold uppercase tracking-widest mb-1">
                        {CATEGORIES.find(c => c.id === item.category)?.translationKey 
                          ? t(CATEGORIES.find(c => c.id === item.category)!.translationKey!) 
                          : item.category}
                      </p>
                      <Link to={`/product/${item.id}`}>
                        <h3 className="font-black text-gray-900 text-lg mb-2 hover:text-brand-600 transition-colors line-clamp-1 italic tracking-tight font-sans">
                          {getTranslatedField(item, 'name', item.name)}
                        </h3>
                      </Link>
                      <p className="text-gray-400 text-xs line-clamp-2 min-h-[32px] font-medium leading-relaxed mb-4">
                        {getTranslatedField(item, 'description', item.description)}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">{t('common.price', 'Preço')}</p>
                        <p className="text-xl font-black text-gray-950 tracking-tight">
                          {formatCurrency(item.price, item.currency || selectedCountry.currency).split(',')[0]}
                          <span className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-40">{item.currency || selectedCountry.currency}</span>
                        </p>
                      </div>

                      <Link
                        to={`/product/${item.id}`}
                        className="px-4 py-2.5 bg-brand-50 hover:bg-brand-600 text-brand-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center cursor-pointer shadow-sm border border-brand-100/50 hover:border-brand-600"
                      >
                        {t('common.view_details', 'Ver')}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
