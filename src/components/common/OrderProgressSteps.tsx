import React from 'react';
import { Clock, CheckCircle2, Package, Truck, Check, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface OrderProgressStepsProps {
  status: string;
  className?: string;
}

export function OrderProgressSteps({ status, className }: OrderProgressStepsProps) {
  const { t } = useTranslation();

  const stages = [
    { key: 'pending', label: t('orders.status_pending', 'Pending'), icon: Clock },
    { key: 'confirmed', label: t('orders.status_confirmed', 'Confirmed'), icon: CheckCircle2 },
    { key: 'processing', label: t('orders.status_processing', 'Processing'), icon: Package },
    { key: 'shipped', label: t('orders.status_shipped', 'Shipped'), icon: Truck },
    { key: 'delivered', label: t('orders.status_delivered', 'Delivered'), icon: Check },
  ];

  const currentIdx = stages.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled';

  return (
    <div className={cn("w-full max-w-sm sm:max-w-md", className)}>
      {isCancelled ? (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100/50 w-fit">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none">{t('orders.cancelled', 'Cancelled')}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between relative pl-0.5 pr-0.5">
          {/* Connector Line behind */}
          <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
          
          {/* Active Connector Line */}
          {currentIdx > 0 && (
            <div 
              className="absolute top-3.5 left-3.5 h-0.5 bg-blue-600 -translate-y-1/2 z-0 rounded-full transition-all duration-500"
              style={{
                width: `calc(${(currentIdx / (stages.length - 1)) * 100}% - 7px)`
              }}
            />
          )}

          {stages.map((stage, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive = idx === currentIdx;
            const isUpcoming = idx > currentIdx;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex flex-col items-center relative z-10 flex-1">
                <div 
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-300 shadow-sm relative",
                    isCompleted && "bg-blue-600 border-blue-600 text-white shadow-blue-100",
                    isActive && "bg-white border-blue-600 text-blue-600 ring-2 ring-blue-50",
                    isUpcoming && "bg-gray-50 border-gray-100 text-gray-400"
                  )}
                  title={stage.label}
                >
                  {isActive && (
                    <span className="absolute -inset-0.5 rounded-lg bg-blue-500/10 animate-pulse" />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                </div>
                
                {/* Micro Label */}
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-wider mt-1 transition-colors text-center block max-w-[50px] truncate sm:max-w-none sm:overflow-visible sm:whitespace-nowrap leading-none",
                  isCompleted && "text-blue-600/80",
                  isActive && "text-blue-600",
                  isUpcoming && "text-gray-400"
                )}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
