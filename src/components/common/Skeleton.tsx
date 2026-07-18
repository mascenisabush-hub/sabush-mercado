import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200",
        variant === 'circular' ? "rounded-full" : "rounded-lg",
        className
      )}
    />
  );
}

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
      <Skeleton className="aspect-square w-full" />
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-8" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function StoreSkeleton() {
  return (
    <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
