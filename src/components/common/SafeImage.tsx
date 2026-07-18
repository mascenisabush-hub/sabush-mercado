import React, { useState, useEffect } from 'react';
import { Package, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  fallbackType?: 'product' | 'store' | 'user';
  className?: string;
}

export function SafeImage({ 
  src, 
  alt = '', 
  fallbackText, 
  fallbackType = 'product', 
  className,
  ...props 
}: SafeImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setLoading(true);
    setError(false);

    if (!src) {
      setError(true);
      setLoading(false);
    }
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  if (error || !src) {
    // Elegant fallback based on entity type
    const initial = fallbackText ? fallbackText.trim().charAt(0).toUpperCase() : '';
    
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-gray-50 text-gray-400 select-none animate-fade-in font-sans",
          fallbackType === 'user' ? "rounded-full" : "rounded-[24px]",
          className
        )}
      >
        {initial ? (
          <div className={cn(
            "font-black text-xl flex items-center justify-center select-none",
            fallbackType === 'user' ? "text-blue-600" : "text-gray-400"
          )}>
            {initial}
          </div>
        ) : fallbackType === 'store' ? (
          <Package className="w-6 h-6 text-gray-300" />
        ) : (
          <ImageIcon className="w-6 h-6 text-gray-300" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden w-full h-full select-none", className)}>
      {loading && (
        <Skeleton className="absolute inset-0 w-full h-full z-10" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
        className={cn(
          "w-full h-full object-cover transition-all duration-500",
          loading ? "opacity-0 scale-95" : "opacity-100 scale-100",
          className
        )}
        {...props}
      />
    </div>
  );
}
