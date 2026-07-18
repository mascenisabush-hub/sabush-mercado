import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { X, Plus, Trash2, Check, AlertCircle, Loader2, Palette, Ruler, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

interface ManageVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdateSuccess?: () => void;
}

const PRESET_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#FBBF24' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Gold', hex: '#D97706' },
  { name: 'Silver', hex: '#9CA3AF' },
];

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42', '44'];

export function ManageVariantsModal({ isOpen, onClose, product, onUpdateSuccess }: ManageVariantsModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected state arrays
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  // Custom addition states
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  // Hydrate states when product changes
  useEffect(() => {
    if (product) {
      setSelectedColors(product.colors || []);
      setSelectedSizes(product.sizes || []);
      setErrorMsg(null);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleToggleColor = (colorName: string) => {
    setSelectedColors(prev => {
      if (prev.includes(colorName)) {
        return prev.filter(c => c !== colorName);
      } else {
        return [...prev, colorName];
      }
    });
  };

  const handleToggleSize = (sizeName: string) => {
    setSelectedSizes(prev => {
      if (prev.includes(sizeName)) {
        return prev.filter(s => s !== sizeName);
      } else {
        return [...prev, sizeName];
      }
    });
  };

  const handleAddCustomColor = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanColor = customColor.trim();
    if (!cleanColor) return;

    if (selectedColors.some(c => c.toLowerCase() === cleanColor.toLowerCase())) {
      setErrorMsg(t('seller.color_exists', 'This color already exists.'));
      return;
    }

    setSelectedColors(prev => [...prev, cleanColor]);
    setCustomColor('');
    setErrorMsg(null);
  };

  const handleAddCustomSize = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSize = customSize.trim();
    if (!cleanSize) return;

    if (selectedSizes.some(s => s.toLowerCase() === cleanSize.toLowerCase())) {
      setErrorMsg(t('seller.size_exists', 'This size already exists.'));
      return;
    }

    setSelectedSizes(prev => [...prev, cleanSize]);
    setCustomSize('');
    setErrorMsg(null);
  };

  const handleRemoveColor = (colorName: string) => {
    setSelectedColors(prev => prev.filter(c => c !== colorName));
  };

  const handleRemoveSize = (sizeName: string) => {
    setSelectedSizes(prev => prev.filter(s => s !== sizeName));
  };

  const handleSave = async () => {
    if (!user || !product.id) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        colors: selectedColors,
        sizes: selectedSizes,
        updatedAt: new Date().toISOString()
      });

      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#4f46e5', '#818cf8']
      });

      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      onClose();
    } catch (err) {
      setErrorMsg(t('seller.save_failed', 'Failed to update product variants.'));
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        />

        {/* Modal Content Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 255 }}
          className="relative bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl z-10 border border-gray-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Palette className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight italic">
                  {t('seller.manage_variants', 'Manage Product Variants')}
                </h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                  {product.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Area */}
          <div className="overflow-y-auto p-6 space-y-8 flex-1">
            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl text-xs font-bold leading-tight flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Colors Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-400" />
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t('seller.color_variants', 'Color Variants')}
                </h4>
              </div>

              {/* Preset list selection */}
              <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t('seller.quick_add_presets', 'Quick Add Color Presets')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => {
                    const isSelected = selectedColors.includes(color.name);
                    return (
                      <button
                        key={color.name}
                        onClick={() => handleToggleColor(color.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-2",
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                            : "bg-white border-gray-250 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        {color.name}
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Input */}
              <form onSubmit={handleAddCustomColor} className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('seller.custom_color_placeholder', 'Add custom color (e.g., Midnight Blue, Beige, #808000)')}
                  className="flex-1 px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 border border-indigo-100"
                >
                  <Plus className="w-4 h-4" /> {t('common.add', 'Add')}
                </button>
              </form>

              {/* Selected List */}
              {selectedColors.length > 0 ? (
                <div className="border border-dashed border-gray-200 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    {t('seller.selected_colors', 'Selected Colors for Product')} ({selectedColors.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedColors.map(color => (
                      <span
                        key={color}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-55 text-gray-700 bg-gray-100/60 rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: color.toLowerCase() }}
                        />
                        {color}
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(color)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50/20 py-4 text-center rounded-2xl border border-dashed border-gray-100">
                  <p className="text-xs text-gray-400 italic font-bold">
                    {t('seller.no_colors', 'No color variants currently active for this product.')}
                  </p>
                </div>
              )}
            </div>

            {/* Sizes Section */}
            <div className="space-y-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-gray-400" />
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t('seller.size_variants', 'Size Variants')}
                </h4>
              </div>

              {/* Preset list selection */}
              <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t('seller.quick_add_presets', 'Quick Add Size Presets')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_SIZES.map(size => {
                    const isSelected = selectedSizes.includes(size);
                    return (
                      <button
                        key={size}
                        onClick={() => handleToggleSize(size)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5",
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                            : "bg-white border-gray-250 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {size}
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Size Input */}
              <form onSubmit={handleAddCustomSize} className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('seller.custom_size_placeholder', 'Add custom size (e.g., XL, 50ml, 1.5 Liters, 15-inch)')}
                  className="flex-1 px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 border border-indigo-100"
                >
                  <Plus className="w-4 h-4" /> {t('common.add', 'Add')}
                </button>
              </form>

              {/* Selected List */}
              {selectedSizes.length > 0 ? (
                <div className="border border-dashed border-gray-200 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    {t('seller.selected_sizes', 'Selected Sizes for Product')} ({selectedSizes.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSizes.map(size => (
                      <span
                        key={size}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/60 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        {size}
                        <button
                          type="button"
                          onClick={() => handleRemoveSize(size)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50/20 py-4 text-center rounded-2xl border border-dashed border-gray-100">
                  <p className="text-xs text-gray-400 italic font-bold">
                    {t('seller.no_sizes', 'No size variants currently active for this product.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-4 bg-white hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500 border border-gray-200 transition-colors disabled:opacity-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 border border-transparent disabled:opacity-55"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('common.save_changes', 'Save Changes')}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
