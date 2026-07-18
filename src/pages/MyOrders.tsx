import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Order, OrderStatus } from '../types';
import { handleFirestoreError, OperationType, parseFirestoreError } from '../lib/firebaseErrors';
import { ShoppingBag, Package, Truck, CheckCircle, Clock, XCircle, ChevronRight, MessageSquare, ArrowLeft, ShieldCheck, MapPin } from 'lucide-react';
import { Link, useNavigate } from '../components/common/RouteLink';
import { formatCurrency, cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../components/common/Skeleton';
import { motion } from 'motion/react';
import { EmptyState } from '../components/common/EmptyState';
import { OrderProgressSteps } from '../components/common/OrderProgressSteps';

export const orderTrackingStages = [
  { stage: 'Order Placed', label: 'Pedido Recebido', subLabel: 'Order Placed', icon: Clock },
  { stage: 'Confirmed by Seller', label: 'Confirmado', subLabel: 'Confirmed by Seller', icon: ShieldCheck },
  { stage: 'Preparing', label: 'Em Preparação', subLabel: 'Preparing', icon: Package },
  { stage: 'Shipped', label: 'Enviado', subLabel: 'Shipped', icon: Truck },
  { stage: 'Out for Delivery', label: 'Saiu para Entrega', subLabel: 'Out for Delivery', icon: MapPin },
  { stage: 'Delivered', label: 'Entregue', subLabel: 'Delivered', icon: CheckCircle }
];

export const getOrderTrackingIndex = (status: string): number => {
  const index = orderTrackingStages.findIndex(s => s.stage === status);
  return index !== -1 ? index : 0;
};

export const getOrderTrackingData = (order: Order) => {
  const status = order.trackingStatus || 'Order Placed';
  const history = order.trackingHistory && order.trackingHistory.length > 0
    ? order.trackingHistory
    : [{ stage: 'Order Placed', timestamp: order.createdAt }];
  return { status, history };
};

export function MyOrders() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Order[]);
      setLoading(false);
      setError(null);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setError(parseFirestoreError(err));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'processing': return <Package className="w-5 h-5 text-purple-500" />;
      case 'shipped': return <Truck className="w-5 h-5 text-blue-600" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-700';
      case 'confirmed': return 'bg-blue-50 text-blue-700';
      case 'processing': return 'bg-purple-50 text-purple-700';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-50 text-green-700';
      case 'cancelled': return 'bg-red-50 text-red-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full rounded-[40px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-gray-900 italic tracking-tight">{t('orders.my_orders')}</h1>
          <p className="text-gray-500 mt-2 font-medium">{t('orders.track_purchases')}</p>
        </div>
        <div className="w-16 h-16 bg-blue-100 rounded-[24px] flex items-center justify-center text-blue-600">
           <ShoppingBag className="w-8 h-8" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-[32px] mb-8 font-bold italic text-center">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {orders.map((order) => {
          const { status: currentTrackingStatus, history: trackingHistory } = getOrderTrackingData(order);
          const currentStageIndex = getOrderTrackingIndex(currentTrackingStatus);

          return (
            <div key={order.id} className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group">
            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4 shrink-0">
                 <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", getStatusColor(order.status).split(' ')[0])}>
                    {getStatusIcon(order.status)}
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('orders.order_id')}</p>
                    <p className="text-sm font-mono font-bold text-gray-900 group-hover:text-blue-600 transition-colors">#{order.id.slice(0, 12).toUpperCase()}</p>
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 md:flex-1 justify-end w-full md:w-auto">
                <OrderProgressSteps status={order.status} className="w-full sm:max-w-[280px] md:max-w-[320px]" />
                <div className="text-left sm:text-right shrink-0">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('orders.total')}</p>
                   <p className="font-black text-gray-900 italic">{formatCurrency(order.totalAmount, order.currency)}</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* Real-time Order Status Tracking Component */}
              <div className="mb-10 bg-gray-50/60 rounded-[32px] p-6 sm:p-8 border border-gray-100/80">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                      {t('orders.progress_tracking', 'Estado Real-time / Real-time Status')}
                    </h4>
                  </div>
                  {order.status === 'cancelled' && (
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100/50">
                      {t('orders.cancelled', 'Cancelled')}
                    </span>
                  )}
                </div>

                {order.status === 'cancelled' ? (
                  <div className="flex items-start gap-4 p-5 bg-red-50/40 rounded-2xl border border-red-100/50">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 flex-shrink-0">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-red-900 text-sm mb-1">
                        {t('orders.cancelled_title', 'Esta encomenda foi cancelada')}
                      </h5>
                      <p className="text-xs text-red-700 font-bold uppercase tracking-wider">
                        {t('orders.cancelled_desc', 'This purchase or transfer was cancelled.')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Horizontal Progress Stepper */}
                    <div className="hidden sm:flex items-center justify-between relative pl-2 pr-2">
                      {/* Grey connecting line */}
                      <div className="absolute top-6 left-6 right-6 h-1 bg-gray-200/60 -translate-y-1/2 z-0 rounded-full" />
                      
                      {/* Filled blue connecting line */}
                      <div 
                        className="absolute top-6 left-6 h-1 bg-blue-600 -translate-y-1/2 z-0 rounded-full transition-all duration-1000 ease-out" 
                        style={{ 
                          width: `calc(${(currentStageIndex / 5) * 100}% - ${(currentStageIndex === 5 ? 12 : 6)}px)` 
                        }}
                      />

                      {orderTrackingStages.map((step, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isActive = idx === currentStageIndex;
                        const isUpcoming = idx > currentStageIndex;
                        const StepIcon = step.icon;
                        const historyEntry = trackingHistory.find(h => h.stage === step.stage);
                        const timestampStr = historyEntry 
                          ? new Date(historyEntry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                          : null;

                        return (
                          <div key={idx} className="flex flex-col items-center relative z-10 flex-1">
                            {/* Circle icon */}
                            <motion.div 
                              whileHover={{ scale: 1.1 }}
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border relative",
                                isCompleted && "bg-blue-600 border-blue-600 text-white shadow-blue-100",
                                isActive && "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50",
                                isUpcoming && "bg-slate-50 border-slate-200 text-slate-400"
                              )}
                            >
                              {isActive && (
                                <span className="absolute -inset-1 rounded-[18px] bg-blue-500/20 animate-pulse" />
                              )}
                              <StepIcon className="w-5 h-5 relative z-10" />
                            </motion.div>

                            {/* Label text */}
                            <div className="text-center mt-3 px-1">
                              <p className={cn(
                                "text-[10px] font-black tracking-tight leading-none mb-1",
                                isActive ? "text-blue-600 font-extrabold" : "text-gray-900",
                                isUpcoming && "text-gray-400/80"
                              )}>
                                {step.label}
                              </p>
                              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                                {step.subLabel}
                              </p>
                              {timestampStr && (
                                <p className="text-[8px] text-blue-500 font-mono font-bold mt-1 bg-blue-50 px-1 py-0.5 rounded inline-block whitespace-nowrap">
                                  {timestampStr}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Vertical Stepper */}
                    <div className="sm:hidden space-y-6 relative pl-7 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200/60 font-sans font-medium">
                      {/* Active vertical line overlay */}
                      <div 
                        className="absolute left-[11px] top-2 bg-blue-600 w-[2px] transition-all duration-1000 ease-out"
                        style={{
                          height: `${(currentStageIndex / 5) * 100}%`
                        }}
                      />

                      {orderTrackingStages.map((step, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isActive = idx === currentStageIndex;
                        const isUpcoming = idx > currentStageIndex;
                        const StepIcon = step.icon;
                        const historyEntry = trackingHistory.find(h => h.stage === step.stage);
                        const timestampStr = historyEntry 
                          ? new Date(historyEntry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                          : null;

                        return (
                          <div key={idx} className="flex gap-4 items-start relative pb-1">
                            {/* Icon Circle */}
                            <div className={cn(
                              "absolute -left-10 w-8 h-8 rounded-xl flex items-center justify-center z-10 border transition-all duration-300 text-xs",
                              isCompleted && "bg-blue-600 border-blue-600 text-white shadow-sm",
                              isActive && "bg-white border-blue-600 text-blue-600 ring-2 ring-blue-100",
                              isUpcoming && "bg-slate-50 border-slate-200 text-slate-400"
                            )}>
                              {isActive && (
                                <span className="absolute -inset-1 rounded-xl bg-blue-500/20 animate-pulse" />
                              )}
                              <StepIcon className="w-4 h-4 relative z-10" />
                            </div>

                            {/* Description texts */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "text-xs font-black tracking-tight",
                                  isActive ? "text-blue-600 font-extrabold" : "text-gray-900",
                                  isUpcoming && "text-gray-400/85"
                                )}>
                                  {step.label} / {step.subLabel}
                                </p>
                                {isActive && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-wider rounded animate-pulse">
                                    {t('orders.active_step', 'Atual / Active')}
                                  </span>
                                )}
                              </div>
                              {timestampStr && (
                                <p className="text-[8px] text-blue-600 font-mono font-bold mt-1 inline-block bg-blue-50 px-1.5 py-0.5 rounded leading-none">
                                  {timestampStr}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

               <div className="space-y-4 mb-8">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                             <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Qty: {item.quantity} • {formatCurrency(item.price, order.currency)}</p>
                               {item.selectedColor && (
                                 <span className="flex items-center gap-1.5 px-1.5 py-0.5 bg-gray-50 rounded text-[9px] font-bold text-gray-500 border border-gray-100">
                                   <div className="w-2 h-2 rounded-full border border-black/5" style={{ backgroundColor: item.selectedColor.toLowerCase() }} />
                                   {item.selectedColor}
                                 </span>
                               )}
                               {item.selectedSize && (
                                 <span className="px-1.5 py-0.5 bg-gray-50 rounded text-[9px] font-bold text-gray-500 border border-gray-100 uppercase">
                                   {item.selectedSize}
                                 </span>
                                )}
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-gray-400 font-medium italic">
                    Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                     <button className="flex-1 sm:flex-none px-6 py-3 bg-gray-50 text-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                        {t('orders.help_center')}
                     </button>
                  </div>
               </div>
            </div>
          </div>
          );
        })}

        {orders.length === 0 && (
          <div className="py-12 bg-white rounded-4xl border border-gray-100 shadow-sm flex items-center justify-center">
             <div className="w-full">
                <EmptyState
                icon={Package}
                title={t('orders.no_orders')}
                description={t('orders.start_shopping_desc')}
                ctaText={t('orders.browse_marketplace')}
                ctaLink="/marketplace"
              />
             </div>
             
             
             <Link to="/marketplace" className="hidden">
                {t('orders.browse_marketplace')} <ChevronRight className="w-4 h-4" />
             </Link>
          </div>
        )}
      </div>
    </div>
  );
}
