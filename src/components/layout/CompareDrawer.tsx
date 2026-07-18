import React, { useState, useEffect, useRef } from 'react';
import { useCompare } from '../../context/CompareContext';
import { useCart } from '../../context/CartContext';
import { useTranslation } from 'react-i18next';
import { 
  X, GitCompare, ArrowRight, Trash2, ShoppingCart, Check, Store, 
  Sparkles, Truck, ChevronLeft, ChevronRight, Info, Award, CirclePercent 
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useLocation as useAppLocation } from '../../context/LocationContext';
import { SafeImage } from '../common/SafeImage';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';

export function CompareDrawer() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { selectedCountry } = useAppLocation();
  const { compareProducts, removeFromCompare, clearCompare } = useCompare();
  const { addToCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Control scrolling indicators for mobile / long comparison tables
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [compareProducts, isOpen]);

  if (compareProducts.length === 0) return null;

  const handleAddToCart = (product: any) => {
    addToCart(product, 1, product.colors?.[0], product.sizes?.[0]);
    setAddedItemIds(prev => [...prev, product.id]);
    setTimeout(() => {
      setAddedItemIds(prev => prev.filter(id => id !== product.id));
    }, 2000);
  };

  // Calculate comparisons highlights if 2 or more products are listed
  const prices = compareProducts.map(p => p.price);
  const minPrice = compareProducts.length >= 2 ? Math.min(...prices) : null;
  const maxPrice = compareProducts.length >= 2 ? Math.max(...prices) : null;

  const ratings = compareProducts.map(p => p.rating || 0);
  const maxRating = compareProducts.length >= 2 && Math.max(...ratings) > 0 ? Math.max(...ratings) : null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmt = 260;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmt : scrollAmt,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <>
      {/* Floating compare launcher bar at the bottom */}
      <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-40">
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 bg-slate-900 border-2 border-blue-500/50 text-white px-5 py-4 rounded-full shadow-[0_20px_50px_rgba(59,130,246,0.4)] hover:bg-black transition-all cursor-pointer font-bold leading-none text-xs tracking-wider uppercase group"
        >
          <div className="relative">
            <GitCompare className="w-4 h-4 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />
            <span className="absolute -top-2.5 -right-2.5 bg-blue-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-900">
              {compareProducts.length}
            </span>
          </div>
          <span>
            {language === 'pt' ? 'Comparar Artigos' : 'Compare Items'} ({compareProducts.length}/3)
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </div>

      {/* Side-Drawer Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Smooth Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            {/* Slide-In Side Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative bg-white h-full shadow-2xl w-full sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[50vw] max-w-5xl flex flex-col z-10 border-l border-gray-100 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 sm:p-8 flex items-center justify-between border-b border-gray-100 bg-slate-50/50 shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-widest pl-1 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    {language === 'pt' ? 'Análise Side-by-Side' : 'Side-by-Side Comparison'}
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 italic tracking-tight flex items-center gap-2.5">
                    <GitCompare className="w-6 h-6 text-blue-600 stroke-[2.5]" />
                    {language === 'pt' ? 'Comparar Produtos' : 'Compare Products'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    {language === 'pt' 
                      ? 'Analise os preços, classificações e características detalhadas lado a lado.' 
                      : 'Analyze prices, ratings, and detailed specifications side-by-side to choose the perfect deal.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={clearCompare}
                    className="p-2 sm:px-4 sm:py-2 text-xs font-black uppercase text-red-500 hover:bg-red-50 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                    title={language === 'pt' ? 'Limpar produtos' : 'Clear all products'}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{language === 'pt' ? 'Limpar' : 'Clear All'}</span>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full text-gray-500 hover:text-gray-900 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mobile Spec Scroll Helpers */}
              {(showLeftArrow || showRightArrow) && (
                <div className="bg-blue-50/50 px-6 py-2 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800 font-semibold shrink-0">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-500" />
                    {language === 'pt' ? 'Deslize horizontalmente para ver mais' : 'Swipe horizontally to view more items'}
                  </span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleScroll('left')} 
                      disabled={!showLeftArrow}
                      className="p-1 rounded bg-white hover:bg-blue-50 text-blue-600 shadow disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleScroll('right')} 
                      disabled={!showRightArrow}
                      className="p-1 rounded bg-white hover:bg-blue-50 text-blue-600 shadow disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable specs layout */}
              <div 
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex-1 overflow-x-auto overflow-y-auto p-6 sm:p-8"
              >
                <div className="min-w-[550px] space-y-6">
                  {/* Grid layout containing the compared items as columns */}
                  <div className="grid grid-cols-4 gap-4 pb-6 border-b border-gray-100">
                    <div className="col-span-1 pt-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        {language === 'pt' ? 'Produtos Selecionados' : 'Selected Products'}
                      </span>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed">
                        {language === 'pt' 
                          ? 'Diferenças de preço e avaliação destacadas de forma inteligente.'
                          : 'Price values and star reviews are highlighted dynamically.'}
                      </p>
                    </div>

                    {compareProducts.map(prod => {
                      const isCheapest = minPrice !== null && prod.price === minPrice;
                      const isHighestRated = maxRating !== null && (prod.rating || 0) === maxRating;

                      return (
                        <div key={prod.id} className="col-span-1 relative flex flex-col space-y-3 p-3 bg-slate-50/50 rounded-2xl border border-gray-100/80 group">
                          <button
                            onClick={() => removeFromCompare(prod.id)}
                            className="absolute top-1 right-1 p-1.5 bg-white hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 shadow-sm border border-slate-100 transition-colors cursor-pointer z-10"
                            title={language === 'pt' ? 'Remover' : 'Remove product'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          {/* Product Image */}
                          <div className="aspect-square w-full rounded-xl overflow-hidden bg-white border border-gray-100/50 flex shrink-0 shadow-sm relative">
                            <SafeImage
                              src={prod.images?.[0]}
                              alt={prod.name}
                              fallbackText={prod.name}
                              fallbackType="product"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            
                            {/* Dynamic Highlight Badges on Image */}
                            {isCheapest && (
                              <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wider animate-pulse">
                                <CirclePercent className="w-2.5 h-2.5" />
                                {language === 'pt' ? 'Melhor Preço' : 'Best Offer'}
                              </div>
                            )}
                            {!isCheapest && isHighestRated && (
                              <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wider">
                                <Award className="w-2.5 h-2.5" />
                                {language === 'pt' ? 'Melhor Avaliado' : 'Top Rated'}
                              </div>
                            )}
                          </div>

                          <div>
                            <span className="text-[9px] bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                              {prod.category}
                            </span>
                            <h4 className="font-extrabold text-slate-900 italic text-xs tracking-tight mt-1.5 line-clamp-2 leading-tight">
                              {prod.name}
                            </h4>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty placeholder slots */}
                    {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                      <div key={`empty-col-${i}`} className="col-span-1 border-2 border-dashed border-slate-100 bg-slate-50/20 rounded-3xl h-full flex flex-col items-center justify-center text-center p-4">
                        <GitCompare className="w-6 h-6 text-slate-200 mb-2" />
                        <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">{language === 'pt' ? 'Espaço Livre' : 'Empty Space'}</p>
                        <p className="text-slate-300/80 text-[9px] font-bold max-w-[120px] mt-1">
                          {language === 'pt' ? 'Adicione produto do catálogo' : 'Add another product to compare'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Comparisons Row Sections */}
                  <div className="space-y-4">
                    {/* Price Spec Row */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Preço' : 'Price'}
                        </span>
                      </div>
                      {compareProducts.map(prod => {
                        const isCheapest = minPrice !== null && prod.price === minPrice;
                        const priceDiff = minPrice !== null && prod.price > minPrice ? prod.price - minPrice : 0;
                        return (
                          <div key={prod.id} className="col-span-1">
                            <p className={cn("font-black text-base leading-none", isCheapest ? "text-emerald-600" : "text-slate-900")}>
                              {formatCurrency(prod.price, selectedCountry.currency)}
                            </p>
                            {priceDiff > 0 && (
                              <p className="text-[10px] text-red-500 font-bold mt-1">
                                +{formatCurrency(priceDiff, selectedCountry.currency)} ({language === 'pt' ? 'mais caro' : 'more'})
                              </p>
                            )}
                            {isCheapest && compareProducts.length >= 2 && (
                              <p className="text-[10px] text-emerald-600 font-black tracking-widest uppercase mt-1">
                                ✨ {language === 'pt' ? 'Poupe no artigo' : 'Cheapest option'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-price-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Average Rating Spec Row */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Avaliação' : 'Rating'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1">
                          <div className="flex items-center gap-1 text-orange-400 font-bold text-sm">
                            ★ {prod.rating ? prod.rating.toFixed(1) : '5.0'}
                            <span className="text-slate-400 font-medium text-xs">
                              ({prod.reviewCount || 0} {language === 'pt' ? 'avaliações' : 'reviews'})
                            </span>
                          </div>
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-val-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Stock volume */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Disponibilidade' : 'Availability / Stock'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1">
                          <span className={cn(
                            "inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                            prod.stock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {prod.stock > 0 
                              ? (language === 'pt' ? `${prod.stock} em stock` : `${prod.stock} in stock`)
                              : (language === 'pt' ? 'Fora de Stock' : 'Out of Stock')}
                          </span>
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-stock-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Minimum order value */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-semibold">
                          {language === 'pt' ? 'Pedido Mínimo' : 'Min Order Qty'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1 font-bold text-slate-800 text-xs">
                          {prod.minOrderQuantity || 1} {language === 'pt' ? 'unidade(s)' : 'unit(s)'}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-min-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Domestic Delivery */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Entrega ao Domicílio' : 'Home Delivery'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1">
                          {prod.deliveryAvailable ? (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black">
                              <Truck className="w-3 h-3" />
                              {language === 'pt' ? 'Sim' : 'Available'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold">
                              {language === 'pt' ? 'Não disponível' : 'Not available'}
                            </span>
                          )}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-deliv-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Size Options */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Tamanhos' : 'Sizes'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1 text-xs font-bold text-gray-600">
                          {prod.sizes && prod.sizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {prod.sizes.map((s: string) => (
                                <span key={s} className="bg-gray-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{s}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium italic">{language === 'pt' ? 'Único' : 'Uni-size'}</span>
                          )}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-sizes-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all items-center">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Cores / Tons' : 'Colors'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1 text-xs text-gray-700">
                          {prod.colors && prod.colors.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {prod.colors.map((c: string) => (
                                <span key={c} className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{c}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium italic">{language === 'pt' ? 'Padrão' : 'Standard'}</span>
                          )}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-colors-${i}`} className="col-span-1" />
                      ))}
                    </div>

                    {/* Description Paragraph */}
                    <div className="grid grid-cols-4 gap-4 py-3.5 hover:bg-slate-50/50 px-2 -mx-2 rounded-xl transition-all">
                      <div className="col-span-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {language === 'pt' ? 'Resumo / Características' : 'Summary'}
                        </span>
                      </div>
                      {compareProducts.map(prod => (
                        <div key={prod.id} className="col-span-1 text-xs font-semibold text-gray-500 leading-relaxed">
                          <p className="line-clamp-6">{prod.description}</p>
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                        <div key={`empty-desc-${i}`} className="col-span-1" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer Area inside the drawer */}
              <div className="p-6 sm:p-8 border-t border-gray-100 bg-slate-50/70 shrink-0">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="col-span-1 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {language === 'pt' ? 'Checkout Rápido' : 'Quick Actions'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      {language === 'pt' ? 'Garanta já o seu artigo favorito.' : 'Add your choice directly.'}
                    </p>
                  </div>

                  {compareProducts.map(prod => {
                    const isAdded = addedItemIds.includes(prod.id);
                    return (
                      <div key={prod.id} className="col-span-1">
                        <button
                          onClick={() => handleAddToCart(prod)}
                          disabled={prod.stock <= 0}
                          className={cn(
                            "w-full py-4 px-3 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 italic cursor-pointer transition-all duration-300 shadow",
                            isAdded 
                              ? "bg-emerald-600 text-white shadow-xl shadow-emerald-100" 
                              : prod.stock > 0 
                                ? "bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700" 
                                : "bg-gray-100 text-gray-400 cursor-not-allowed border"
                          )}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> 
                              <span>{language === 'pt' ? 'Adicionado!' : 'Added!'}</span>
                            </>
                          ) : prod.stock > 0 ? (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" /> 
                              <span>{language === 'pt' ? 'Comprar' : 'Buy Now'}</span>
                            </>
                          ) : (
                            <span>{language === 'pt' ? 'Sem Stock' : 'Out of Stock'}</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 3 - compareProducts.length) }).map((_, i) => (
                    <div key={`empty-act-${i}`} className="col-span-1" />
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500 font-bold">
                  <span className="flex items-center gap-2 text-slate-600">
                    <Store className="w-4 h-4 text-blue-600 shrink-0" />
                    {language === 'pt' 
                      ? 'Dica de Compra: Pode cruzar artigos de fornecedores e pagar todos juntos no carrinho de compras.'
                      : 'Purchase Tip: You can cross articles from different suppliers and checkout everything instantly.'}
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-full font-black uppercase tracking-wider text-[10px] leading-none shrink-0"
                  >
                    {language === 'pt' ? 'Voltar ao Catálogo' : 'Return to Catalog'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
