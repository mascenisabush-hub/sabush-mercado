import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from './RouteLink';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaText?: string;
  ctaLink?: string;
  onCtaClick?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  ctaLink,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 max-w-md mx-auto"
    >
      <div className="w-24 h-24 bg-brand-50 rounded-4xl flex items-center justify-center mb-6 text-brand-600 shadow-sm border border-brand-100/30">
        <Icon className="w-10 h-10" />
      </div>
      
      <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight italic">
        {title}
      </h3>
      
      <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed max-w-sm">
        {description}
      </p>

      {ctaText && (
        <>
          {ctaLink ? (
            <Link
              to={ctaLink}
              className="px-6 py-3.5 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-200"
            >
              {ctaText}
            </Link>
          ) : (
            <button
              onClick={onCtaClick}
              className="px-6 py-3.5 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-200"
            >
              {ctaText}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
