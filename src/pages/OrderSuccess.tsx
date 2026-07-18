import React from 'react';
import { CheckCircle, ArrowRight, Package, Truck, MessageSquare } from 'lucide-react';
import { Link } from '../components/common/RouteLink';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export function OrderSuccess() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8"
      >
        <CheckCircle className="w-12 h-12" />
      </motion.div>
      
      <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Order Placed Successfully!</h1>
      <p className="text-gray-500 text-lg mb-4">Thank you for shopping on Mercado Sabush. Your order has been registered.</p>
      <div className="bg-blue-50 border border-blue-100 px-6 py-3 rounded-2xl inline-flex items-center gap-2 mb-12">
        <span className="text-blue-600 animate-pulse text-lg">🚀</span>
        <p className="text-sm font-bold text-blue-700">Smart-routing prioritized the seller physically closest to you!</p>
      </div>

      {!user && (
        <div className="bg-gradient-to-r from-blue-50/70 to-orange-50/40 border border-blue-100 p-8 rounded-[40px] text-left mb-12 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
          <h3 className="font-black text-gray-900 text-xl tracking-tight mb-2">
            Guardar o seu Histórico de Pedidos? 📦
          </h3>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
            Save your order history? Create an account!
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Crie uma conta gratuita hoje mesmo para gerir e acompanhar todos os seus pedidos de forma simples e segura, guardar favoritos e aceder ao chat privado com vendedores!
          </p>
          <Link 
            to="/login?mode=register" 
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
          >
            Criar Conta / Create Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm text-left mb-12 space-y-6">
        <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">What happens next?</h3>
        
        <div className="flex gap-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
             <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Seller will contact you</p>
            <p className="text-sm text-gray-500">The seller will reach out via WhatsApp or phone to confirm delivery details.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
             <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Order Processing</p>
            <p className="text-sm text-gray-500">The store will start preparing your items for pickup or delivery.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
             <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Delivery / Pickup</p>
            <p className="text-sm text-gray-500">Once ready, your order will be delivered to your location or ready for pickup.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
         <Link to="/marketplace" className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
           Continue Shopping
         </Link>
         <Link to="/profile" className="px-10 py-5 bg-white border border-gray-200 text-gray-900 rounded-2xl font-black text-lg hover:bg-gray-50 transition-all">
           View My Orders
         </Link>
      </div>
    </div>
  );
}
