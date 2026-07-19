import React, { useState } from 'react';
import { X, Send, Package, Hash, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Product } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';

interface RFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export function RFQModal({ isOpen, onClose, product }: RFQModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: product.minOrderQuantity.toString(),
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'rfqs'), {
        customerId: user.uid,
        storeId: product.storeId,
        productId: product.id,
        productName: product.name,
        quantity: parseInt(formData.quantity),
        description: formData.description,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      onClose();
      alert(t('b2b.rfq_sent'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rfqs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 italic">{t('b2b.rfq')}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">B2B Sourcing Request</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-3xl flex gap-4 border border-gray-100">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                   <img src={product.images[0]} className="w-full h-full object-cover" alt="" loading="lazy" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                  <p className="text-xs text-gray-400">{t('b2b.min_order')}: {product.minOrderQuantity} units</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                    <Hash className="w-3 h-3" /> {t('b2b.quantity_needed')}
                  </label>
                  <input 
                    type="number" 
                    required
                    min={product.minOrderQuantity}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> {t('b2b.additional_details')}
                  </label>
                  <textarea 
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium resize-none h-32"
                    placeholder="Describe your requirements, shipping destination, etc..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black text-lg hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 italic"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('b2b.send_rfq')}
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
