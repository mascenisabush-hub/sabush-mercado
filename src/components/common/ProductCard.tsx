import React from 'react';
import { Star, Zap, PlusCircle, Store, MessageSquare } from 'lucide-react';
import { Link } from './RouteLink';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../../lib/utils';
import { CATEGORIES } from '../../constants';
import { useTranslation } from 'react-i18next';
import { getTranslatedField } from '../../lib/i18nUtils';
import { Product, Store as StoreType } from '../../types';

interface ProductCardProps {
  product: Product;
  store?: StoreType;
  animate?: boolean;
}

export function ProductCard({ product, store, animate = true }: ProductCardProps) {
  const { t } = useTranslation();
  
  const productCategory = CATEGORIES.find(c => c.id === product.category);
  const categoryLabel = productCategory 
    ? (productCategory.translationKey ? t(productCategory.translationKey) : productCategory.name)
    : product.category;
  
  const productImg = product.images?.[0] || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=70&w=300';
  const ratingVal = product.rating || 4.8;
  const reviewCountVal = product.reviewCount || 0;
  const storeName = store?.businessName || t('common.store', 'Store');
  const translatedName = getTranslatedField(product, 'name', product.name);

  const CardWrapper = animate ? motion.div : 'div';
  const wrapperProps = animate ? {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  } : {};

  return (
    <CardWrapper 
      {...wrapperProps}
      className="bg-white rounded-3xl border border-gray-100 overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300 flex flex-col justify-between h-full"
    >
      <div className="relative h-44 sm:h-48 overflow-hidden bg-gray-50">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img 
            src={productImg} 
            alt={translatedName} 
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </Link>
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm p-2 rounded-full shadow-md">
          <Zap className="w-3.5 h-3.5 text-accent-500 fill-accent-500 animate-pulse" />
        </div>
        {product.deliveryAvailable && (
          <div className="absolute bottom-3 left-3 bg-success-500/95 backdrop-blur-sm text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-success-400/20">
            {t('home.delivery_available')}
          </div>
        )}
      </div>
      
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-[10px] text-brand-600 font-extrabold uppercase tracking-widest mb-1.5 block">
            {categoryLabel}
          </span>
          <Link to={`/product/${product.id}`}>
            <h3 className="font-extrabold text-gray-900 text-base sm:text-lg mb-1.5 group-hover:text-brand-600 transition-colors line-clamp-2 min-h-[2.5rem]">
              {translatedName}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 mb-3.5">
            <div className="flex items-center text-accent-400">
              <Star className="w-3.5 h-3.5 fill-accent-400" />
            </div>
            <span className="text-xs font-black text-gray-800">{ratingVal}</span>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              ({reviewCountVal} {t('reviews.title', 'Reviews')})
            </span>
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg sm:text-xl font-black text-brand-600 leading-none">
                {formatCurrency(product.price, product.currency || 'MZN')}
              </p>
            </div>
            <Link to={`/product/${product.id}`} className="w-8 h-8 bg-gray-50 hover:bg-brand-600 text-gray-405 hover:text-white rounded-full flex items-center justify-center transition-all shadow-sm border border-gray-100">
              <PlusCircle className="w-5 h-5 shrink-0" />
            </Link>
          </div>
          
          <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
            <Link to={`/store/${product.storeId}`} className="text-xs font-bold text-gray-600 flex items-center gap-1.5 hover:text-brand-600 transition-colors truncate max-w-[150px]">
              <Store className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {storeName}
            </Link>
            {store?.whatsappNumber && (
              <a 
                href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-emerald-500 hover:scale-110 transition-transform p-1 shrink-0"
              >
                <MessageSquare className="w-4.5 h-4.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
