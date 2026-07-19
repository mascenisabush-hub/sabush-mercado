import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Store, Product } from '../types';
import { Star, MapPin, MessageSquare, ShieldCheck, Flag, ArrowLeft, Share2, Heart, Search, Filter, CheckCircle2, Award, Zap, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from '../components/common/RouteLink';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { ReportModal } from '../components/modals/ReportModal';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { StoreReviews } from '../components/common/Reviews';
import { useLanguage } from '../context/LanguageContext';
import { calculateStoreChatStats, calculateStoreOrderStats } from '../lib/trustSignals';
import { EmptyState } from '../components/common/EmptyState';
import { AlertCircle } from 'lucide-react';

export function StoreDetails({ id }: { id: string }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchStore() {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', id));
        if (storeDoc.exists()) {
          const storeData = { ...storeDoc.data(), id: storeDoc.id } as Store;
          
          // Calculate stats in real-time or fall back gracefully
          const chatStats = await calculateStoreChatStats(storeData.ownerId);
          const orderStats = await calculateStoreOrderStats(id);
          
          const enrichedStore: Store = {
            ...storeData,
            responseRate: storeData.responseRate !== undefined ? storeData.responseRate : chatStats.responseRate,
            averageResponseTime: storeData.averageResponseTime !== undefined ? storeData.averageResponseTime : chatStats.averageResponseTimeText,
            fulfillmentRate: storeData.fulfillmentRate !== undefined ? storeData.fulfillmentRate : orderStats.fulfillmentRate,
            totalSales: storeData.totalSales !== undefined ? storeData.totalSales : orderStats.totalSales
          };
          
          setStore(enrichedStore);
          
          // Fetch products for this store
          const q = query(collection(db, 'products'), where('storeId', '==', id));
          const querySnapshot = await getDocs(q);
          setProducts(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[]);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `stores/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchStore();
  }, [id]);

  useEffect(() => {
    if (store?.whatsappNumber) {
      window.dispatchEvent(
        new CustomEvent('sabush:whatsapp:update', {
          detail: {
            number: store.whatsappNumber,
            message: `Olá, ${store.businessName}! Encontrei a sua loja "${store.businessName}" no Mercado Sabush e gostaria de conversar consigo sobre os seus produtos.`,
            name: store.businessName
          }
        })
      );
    }
  }, [store]);

  // Dynamic Document Title and Open Graph Meta Tags for Store Page
  useEffect(() => {
    if (!store) return;

    const prevTitle = document.title;
    const storeName = store.businessName;
    const storeDescription = store.description || `Visite a loja ${storeName} no Mercado Sabush de Moçambique!`;
    const newTitle = `${storeName} | Mercado Sabush`;
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

    const storeLogo = store.logo || store.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200';
    const currentUrl = window.location.href;

    updateMetaTag('og:title', newTitle);
    updateMetaTag('og:description', storeDescription);
    updateMetaTag('og:image', storeLogo);
    updateMetaTag('og:url', currentUrl);
    updateMetaTag('og:type', 'website');

    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', newTitle, 'name');
    updateMetaTag('twitter:description', storeDescription, 'name');
    updateMetaTag('twitter:image', storeLogo, 'name');

    return () => {
      document.title = prevTitle;
    };
  }, [store]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title="Store Not Found"
          description="The store you are looking for does not exist or has been removed."
          ctaText="Back to Marketplace"
          ctaLink="/marketplace"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      {/* Banner & Profile */}
      <div className="relative mb-32">
        <div className="h-64 sm:h-80 w-full rounded-[40px] overflow-hidden relative border border-gray-100">
          <img 
            src={store.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200'} 
            className="w-full h-full object-cover" 
            alt="Store Banner"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        </div>
        
        <div className="absolute -bottom-24 left-8 right-8 flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
          <div className="flex items-end gap-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[40px] bg-white p-2 shadow-2xl border border-gray-100 relative z-10">
              <div className="w-full h-full rounded-[32px] overflow-hidden bg-blue-600 flex items-center justify-center text-white text-4xl font-black">
                {store.logo ? <img src={store.logo} alt="" className="w-full h-full object-cover" loading="lazy" /> : store.businessName[0]}
              </div>
            </div>
            <div className="pb-4">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight italic">{store.businessName}</h1>
                {store.isVerified && <ShieldCheck className="w-8 h-8 text-blue-600 fill-blue-50" />}
                {store.isVerifiedBusiness && <CheckCircle2 className="w-8 h-8 text-blue-500 fill-blue-50" />}
              </div>
              <div className="flex items-center gap-4 text-gray-500 font-bold text-sm">
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-orange-400 fill-orange-400" /> {store.rating} ({store.reviewCount} reviews)</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {store.location}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span className="text-blue-600 uppercase tracking-widest text-[10px] bg-blue-50 px-2 py-0.5 rounded-full">{store.category}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 mb-4">
            <button className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors text-gray-400 hover:text-blue-600"><Share2 className="w-6 h-6" /></button>
            <button className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors text-gray-400 hover:text-red-500"><Heart className="w-6 h-6" /></button>
            <a 
              href={`https://wa.me/${store.whatsappNumber}?text=Hi, I found your store on Mercado Sabush.`}
              className="px-8 py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-600 transition-all flex items-center gap-2 italic"
            >
              <MessageSquare className="w-5 h-5" /> Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mt-12">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          {/* Trust Badge Panel */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-gray-900 italic tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              {language === 'pt' ? 'Sinais de Confiança' : 'Vendor Trust'}
            </h3>
            
            {store.isVerifiedBusiness && (
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-150 rounded-2xl text-blue-700">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="leading-tight">
                  <p className="text-xs font-black uppercase tracking-widest">{language === 'pt' ? 'Empresa Verificada' : 'Verified Business'}</p>
                  <p className="text-[10px] text-blue-500 font-bold">{language === 'pt' ? 'Identidade e alvará validados' : 'Identity & license validated'}</p>
                </div>
              </div>
            )}

            {/* Response Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-500">{language === 'pt' ? 'Taxa de Resposta' : 'Response Rate'}</span>
                <span className={cn(
                  "font-black",
                  (store.responseRate || 100) > 80 ? "text-emerald-600" : (store.responseRate || 100) >= 50 ? "text-amber-500" : "text-rose-500"
                )}>
                  {store.responseRate !== undefined ? store.responseRate : 100}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (store.responseRate || 100) > 80 ? "bg-emerald-500" : (store.responseRate || 100) >= 50 ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${store.responseRate !== undefined ? store.responseRate : 100}%` }}
                />
              </div>
            </div>

            {/* Fulfillment Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-500">{language === 'pt' ? 'Sucesso de Encomendas' : 'Fulfillment Rate'}</span>
                <span className={cn(
                  "font-black",
                  (store.fulfillmentRate || 100) > 80 ? "text-emerald-600" : (store.fulfillmentRate || 100) >= 50 ? "text-amber-500" : "text-rose-500"
                )}>
                  {store.fulfillmentRate !== undefined ? store.fulfillmentRate : 100}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (store.fulfillmentRate || 100) > 80 ? "bg-emerald-500" : (store.fulfillmentRate || 100) >= 50 ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${store.fulfillmentRate !== undefined ? store.fulfillmentRate : 100}%` }}
                />
              </div>
            </div>

            {/* Average Response Time */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
              <Zap className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'pt' ? 'Tempo de Resposta' : 'Replies Usually'}</p>
                <p className="text-xs font-bold text-gray-900">{store.averageResponseTime || 'Replies usually in a few hours'}</p>
              </div>
            </div>

            {/* Total Sales */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
              <TrendingUp className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'pt' ? 'Total de Vendas' : 'Total Sales'}</p>
                <p className="text-xs font-black text-gray-900">{store.totalSales || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-gray-900 mb-6 italic">Store Info</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-gray-600 font-medium leading-relaxed">{store.description || "No description provided."}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Delivery Options</p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
                    {store.deliveryOptions}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors mt-8"
              >
                <Flag className="w-4 h-4" /> Report Store
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 mb-8 gap-8">
            <button
              onClick={() => setActiveTab('products')}
              className={cn(
                "pb-4 font-black italic text-lg tracking-tight transition-all relative cursor-pointer",
                activeTab === 'products'
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {language === 'pt' ? `Produtos (${products.length})` : `Products (${products.length})`}
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={cn(
                "pb-4 font-black italic text-lg tracking-tight transition-all relative cursor-pointer",
                activeTab === 'reviews'
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {language === 'pt' ? 'Comentários e Avaliações' : 'Feedback & Ratings'}
            </button>
          </div>

          {activeTab === 'products' ? (
            <>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-black text-gray-900 italic">
                  {language === 'pt' ? 'Produtos da Loja' : 'Store Products'} ({products.length})
                </h2>
                <div className="flex gap-4 w-full sm:w-auto">
                   <div className="relative flex-1 sm:w-64">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                     <input 
                       type="text" 
                       placeholder={language === 'pt' ? 'Pesquisar loja...' : 'Search store...'}
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900"
                     />
                   </div>
                   <button className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-gray-100"><Filter className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {products
                  .filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((product) => (
                    <motion.div 
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group"
                    >
                      <Link to={`/product/${product.id}`} className="block">
                        <div className="aspect-square rounded-[32px] overflow-hidden bg-gray-100 mb-4 relative">
                          <img 
                            src={product.images[0]} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 bg-white rounded-xl shadow-lg text-gray-400 hover:text-red-500 transition-colors">
                              <Heart className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-medium mb-2">{product.category}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-black text-gray-900">{formatCurrency(product.price)}</p>
                          <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <Star className="w-3 h-3 text-orange-400 fill-orange-400" /> {product.rating || '0.0'}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
              </div>

              {products.length === 0 && (
                <div className="bg-gray-50 rounded-[40px] p-20 text-center border border-dashed border-gray-200">
                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                     <ShoppingBag className="w-10 h-10 text-gray-200" />
                   </div>
                   <h3 className="text-xl font-black text-gray-900 mb-2">
                     {language === 'pt' ? 'Nenhum produto ainda' : 'No products yet'}
                   </h3>
                   <p className="text-gray-500 font-medium">
                     {language === 'pt' ? 'Esta loja ainda não listou produtos para venda.' : "This store hasn't listed any products for sale."}
                   </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-sm animate-fade-in">
              <StoreReviews storeId={id} />
            </div>
          )}
        </div>
      </div>

      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        targetId={id}
        targetType="store"
      />
    </div>
  );
}

function ShoppingBag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
