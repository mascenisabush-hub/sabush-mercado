import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { X, Package, Camera, Plus, Trash2, ArrowRight, Wand2, Sparkles, Loader2, Search, Crop, Check, AlertCircle, UploadCloud, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../../constants';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { ImageCropper } from '../common/ImageCropper';
import { Product, Store } from '../../types';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import confetti from 'canvas-confetti';
import { cn } from '../../lib/utils';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
}

export function AddProductModal({ isOpen, onClose, store }: AddProductModalProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);
  const [moderating, setModerating] = useState<number | null>(null);
  const [moderationErrors, setModerationErrors] = useState<Record<number, string>>({});
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUploadMultiple = async (file: File) => {
    if (!user) return;
    
    let targetIndex = formData.images.findIndex(img => img === '');
    if (targetIndex === -1) {
      targetIndex = formData.images.length;
    }
    
    setUploadingIndex(targetIndex);
    
    try {
      const reader = new FileReader();
      const localUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const localDataUrl = await localUrlPromise;
      
      setFormData(prev => {
        const nextImages = [...prev.images];
        if (nextImages[targetIndex] === '') {
          nextImages[targetIndex] = localDataUrl;
        } else {
          nextImages.push(localDataUrl);
        }
        return { ...prev, images: nextImages };
      });
      
      setCroppingIndex(targetIndex);
    } catch (err) {
      console.error("Local file read failed:", err);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleDirectFileUpload = async (index: number, file: File) => {
    if (!user) return;
    setUploadingIndex(index);
    try {
      const reader = new FileReader();
      const localUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const localDataUrl = await localUrlPromise;
      
      setFormData(prev => {
        const nextImages = [...prev.images];
        nextImages[index] = localDataUrl;
        return { ...prev, images: nextImages };
      });
      
      setCroppingIndex(index);
    } catch (err) {
      console.error("Local file read failed:", err);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      await handleFileUploadMultiple(file);
    }
  };
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock: '',
    purchasingPrice: '',
    unitCxStock: '0',
    unitEmbStock: '0',
    unitUnStock: '0',
    minOrderQuantity: '1',
    images: [''],
    deliveryAvailable: true,
    colors: '',
    sizes: '',
    keyFeatures: ''
  });

  const [wholesaleTiers, setWholesaleTiers] = useState<{minQuantity: string, price: string}[]>([]);

  const selectedCategory = CATEGORIES.find(c => c.id === formData.category);
  const isService = selectedCategory?.type === 'service';

  const addTier = () => {
    setWholesaleTiers([...wholesaleTiers, { minQuantity: '', price: '' }]);
  };

  const removeTier = (index: number) => {
    setWholesaleTiers(wholesaleTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: 'minQuantity' | 'price', value: string) => {
    setWholesaleTiers(prev => prev.map((tier, i) => i === index ? { ...tier, [field]: value } : tier));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !store?.id) return;

    // Check if any images have moderation errors
    if (Object.keys(moderationErrors).length > 0) {
       alert(t('seller.resolve_moderation'));
       return;
    }

    setLoading(true);
    try {
      const storeId = store.id;
      // Auto-translate name and description
      const targetLangs = ['en', 'pt', 'fr'].filter(l => l !== i18n.language);
      
      let translations: any = {};
      
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const nameRes = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ text: formData.name, targetLanguages: targetLangs })
        });
        const nameTrans = await nameRes.json();
        
        const descRes = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ text: formData.description, targetLanguages: targetLangs })
        });
        const descTrans = await descRes.json();

        translations[i18n.language] = {
           name: formData.name,
           description: formData.description
        };

        targetLangs.forEach(lang => {
          translations[lang] = {
            name: nameTrans[lang] || formData.name,
            description: descTrans[lang] || formData.description
          };
        });
      } catch (err) {
        console.error("Auto-translation failed:", err);
      }

      const tiers = wholesaleTiers
        .filter(t => t.minQuantity && t.price)
        .map(t => ({
          minQuantity: parseInt(t.minQuantity),
          price: parseFloat(t.price)
        }));

      const selectedCategoryObj = CATEGORIES.find(c => c.id === formData.category);
      const isServiceType = selectedCategoryObj?.type === 'service';

      const calculatedStock = isServiceType
        ? 99999
        : (parseInt(formData.unitCxStock) || 0) + (parseInt(formData.unitEmbStock) || 0) + (parseInt(formData.unitUnStock) || 0);

      await addDoc(collection(db, 'products'), {
        storeId,
        sellerId: user.uid,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        country: store.country || 'MZ',
        currency: store.currency || 'MZN',
        category: formData.category,
        stock: calculatedStock,
        type: isServiceType ? 'service' : 'product',
        purchasingPrice: isServiceType ? 0 : (parseFloat(formData.purchasingPrice) || 0),
        unitCxStock: isServiceType ? 0 : (parseInt(formData.unitCxStock) || 0),
        unitEmbStock: isServiceType ? 0 : (parseInt(formData.unitEmbStock) || 0),
        unitUnStock: isServiceType ? 0 : (parseInt(formData.unitUnStock) || 0),
        minOrderQuantity: parseInt(formData.minOrderQuantity),
        wholesalePrices: tiers.length > 0 ? tiers : null,
        colors: isServiceType ? [] : formData.colors.split(',').map(c => c.trim()).filter(c => c !== ''),
        sizes: isServiceType ? [] : formData.sizes.split(',').map(s => s.trim()).filter(s => s !== ''),
        images: formData.images.filter(img => img.trim() !== ''),
        deliveryAvailable: formData.deliveryAvailable,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        translations
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa']
      });

      onClose();
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        stock: '',
        purchasingPrice: '',
        unitCxStock: '0',
        unitEmbStock: '0',
        unitUnStock: '0',
        minOrderQuantity: '1',
        images: [''],
        deliveryAvailable: true,
        colors: '',
        sizes: '',
        keyFeatures: ''
      });
      setWholesaleTiers([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    } finally {
      setLoading(false);
    }
  };

  const addImageField = () => {
    setFormData({ ...formData, images: [...formData.images, ''] });
  };

  const removeImageField = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages.length ? newImages : [''] });
  };

  const updateImageField = (index: number, value: string) => {
    const newImages = [...formData.images];
    newImages[index] = value;
    setFormData({ ...formData, images: newImages });
    if (value.startsWith('http')) {
      moderateImage(index, value);
    }
  };

  const moderateImage = async (index: number, url: string) => {
    setModerating(index);
    setModerationErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ imageUrl: url, productName: formData.name })
      });
      const data = await res.json();
      if (!data.safe) {
        setModerationErrors(prev => ({ ...prev, [index]: data.reason }));
      }
    } catch (err) {
      console.error("Moderation check failed:", err);
    } finally {
      setModerating(null);
    }
  };

  const searchImages = async () => {
    if (!formData.name) return;
    setSearchingImages(true);
    setShowSuggestions(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/search-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ productName: formData.name, category: formData.category })
      });
      const data = await res.json();
      setImageSuggestions(data.images || []);
    } catch (err) {
      console.error("Image search failed:", err);
    } finally {
      setSearchingImages(false);
    }
  };

  const selectSuggestion = async (url: string) => {
    const emptyIndex = formData.images.findIndex(img => img === '');
    const newImages = [...formData.images];
    const index = emptyIndex !== -1 ? emptyIndex : newImages.length;
    
    if (emptyIndex !== -1) {
      newImages[emptyIndex] = url;
    } else {
      newImages.push(url);
    }
    
    setFormData({ ...formData, images: newImages });
    moderateImage(index, url);
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (croppingIndex === null) return;
    
    const cropIdx = croppingIndex;
    setCroppingIndex(null);
    setUploadingIndex(cropIdx);
    
    try {
      const storage = getStorage();
      const filename = `products/${user?.uid}/${Date.now()}_cropped.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadString(storageRef, croppedDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      
      setFormData(prev => {
        const nextImages = [...prev.images];
        nextImages[cropIdx] = downloadUrl;
        return { ...prev, images: nextImages };
      });
      moderateImage(cropIdx, downloadUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      // Fallback to data URL if upload fails (though not ideal for storage)
      setFormData(prev => {
        const nextImages = [...prev.images];
        nextImages[cropIdx] = croppedDataUrl;
        return { ...prev, images: nextImages };
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const suggestDescription = async () => {
    if (!formData.name) return;
    setGenerating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/suggest-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ 
          productName: formData.name, 
          category: formData.category,
          keyFeatures: formData.keyFeatures
        })
      });
      const data = await res.json();
      if (data.description) {
        setFormData({ ...formData, description: data.description });
      }
    } catch (err) {
      console.error("AI Suggestion failed:", err);
    } finally {
      setGenerating(false);
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
            className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                    <Package className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 italic">{t('seller.new_product')}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex items-center justify-between ml-4 mr-2">
                         <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                           {isService ? 'Nome do Serviço / Service Name' : 'Nome do Produto / Product Name'}
                         </label>
                         <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                           <Wand2 className="w-2.5 h-2.5" /> Auto-translating enabled
                         </span>
                       </div>
                      <input 
                        type="text" 
                        required
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        placeholder={isService ? 'Ex: Instalação Eléctrica Básica / Assistência' : 'Ex: iPhone 15 Pro'}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Category</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        <optgroup label={`📦 Product Categories / Categorias de Produtos`}>
                          {CATEGORIES.filter(cat => cat.type === 'product' || !cat.type).map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.translationKey ? t(cat.translationKey) : cat.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={`🛠️ Service Categories / Categorias de Serviços`}>
                          {CATEGORIES.filter(cat => cat.type === 'service').map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.translationKey ? t(cat.translationKey) : cat.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {!isService && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Colors (Comma separated)</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            placeholder="Red, Blue, Green"
                            value={formData.colors}
                            onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Sizes (Comma separated)</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            placeholder="S, M, L, XL"
                            value={formData.sizes}
                            onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {!isService && (
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Preço de Custo (Purchasing Price) *</label>
                          <input 
                            type="number" 
                            required
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            placeholder="0.00"
                            value={formData.purchasingPrice}
                            onChange={(e) => setFormData({ ...formData, purchasingPrice: e.target.value })}
                          />
                        </div>
                      )}
                      <div className={cn("space-y-2", isService ? "col-span-2" : "")}>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">
                          {isService ? 'Preço do Serviço / Service Price' : 'Preço de Venda / Selling Price'} ({store.currency || 'MZN'}) *
                        </label>
                        <input 
                          type="number" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          placeholder="0.00"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                      </div>
                    </div>

                    {!isService && (
                      <div className="space-y-3 bg-gray-50/50 p-6 rounded-[28px] border border-gray-100/10">
                        <div className="flex items-center justify-between ml-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Stock em Unidades / Stock Units</label>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Pode registar todos os que restam</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Cx (Caixas)</label>
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                              placeholder="0"
                              min="0"
                              value={formData.unitCxStock}
                              onChange={(e) => setFormData({ ...formData, unitCxStock: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Emb (Emballage)</label>
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                              placeholder="0"
                              min="0"
                              value={formData.unitEmbStock}
                              onChange={(e) => setFormData({ ...formData, unitEmbStock: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Un (Unidade)</label>
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                              placeholder="0"
                              min="0"
                              value={formData.unitUnStock}
                              onChange={(e) => setFormData({ ...formData, unitUnStock: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between ml-4">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Wholesale & MOQ</label>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-4">Min Order Quantity (MOQ)</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          value={formData.minOrderQuantity}
                          onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between ml-4">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Bulk Pricing Tiers</label>
                          <button 
                            type="button"
                            onClick={addTier}
                            className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Tier
                          </button>
                        </div>
                        
                        {wholesaleTiers.map((tier, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <input 
                                type="number" 
                                placeholder="Min Qty"
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold"
                                value={tier.minQuantity}
                                onChange={(e) => updateTier(i, 'minQuantity', e.target.value)}
                              />
                            </div>
                            <div className="flex-1">
                              <input 
                                type="number" 
                                placeholder={`Price (${store.currency || 'MZN'})`}
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold"
                                value={tier.price}
                                onChange={(e) => updateTier(i, 'price', e.target.value)}
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeTier(i)}
                              className="p-2 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex items-center justify-between ml-4 mr-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('seller.product_images')}</label>
                          <button 
                            type="button"
                            onClick={searchImages}
                            disabled={!formData.name || searchingImages}
                            className="text-[10px] text-blue-600 font-black flex items-center gap-1 hover:underline disabled:opacity-50"
                          >
                            {searchingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            {t('seller.auto_search_images')}
                          </button>
                       </div>

                       {/* Direct Upload & Drag & Drop Master Hub */}
                       <div 
                         onDragOver={handleDragOver}
                         onDragLeave={handleDragLeave}
                         onDrop={handleDrop}
                         onClick={() => document.getElementById('master-image-upload')?.click()}
                         className={cn(
                           "border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                           isDragging 
                             ? "border-blue-500 bg-blue-50/40 text-blue-600 scale-[0.98]" 
                             : "border-gray-100 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/10 text-gray-500"
                         )}
                       >
                         <UploadCloud className={cn("w-10 h-10 transition-transform", isDragging ? "scale-110 text-blue-500 animate-pulse" : "text-gray-400")} />
                         <div className="space-y-1">
                           <p className="text-xs font-bold text-gray-700">
                             {t('seller.drag_drop_images', 'Drag & drop image(s) here, or click to browse')}
                           </p>
                           <p className="text-[10px] text-gray-400 block">
                             Supports direct file upload, automatically backed by safe AI verification.
                           </p>
                         </div>
                         <input 
                           id="master-image-upload"
                           type="file"
                           multiple
                           accept="image/*"
                           className="hidden"
                           onChange={async (e) => {
                             const files = Array.from(e.target.files || []);
                             for (const file of files) {
                               await handleFileUploadMultiple(file);
                             }
                           }}
                         />
                       </div>

                      <div className="space-y-3">
                        {formData.images.map((img, i) => (
                          <div key={i} className="space-y-2">
                            <div className={cn(
                              "relative group p-4 bg-gray-50 rounded-2xl border-2 transition-all",
                              moderationErrors[i] ? "border-red-200 bg-red-50" : "border-transparent group-hover:border-gray-200"
                            )}>
                              <div className="flex gap-3">
                                <div className="w-16 h-16 bg-white rounded-xl border border-gray-100 overflow-hidden flex-shrink-0 relative">
                                  {img ? (
                                    <img src={img} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                      <Camera className="w-6 h-6" />
                                    </div>
                                  )}
                                  {(moderating === i || uploadingIndex === i) && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <input 
                                    type="url" 
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs font-bold text-gray-900 placeholder-gray-400"
                                    placeholder="Paste URL or choose file below..."
                                    value={img}
                                    onChange={(e) => updateImageField(i, e.target.value)}
                                  />
                                  <div className="flex items-center gap-3 mt-2">
                                     <label className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase tracking-widest hover:underline cursor-pointer">
                                       <UploadCloud className="w-3 h-3" /> {t('seller.upload', 'Upload File')}
                                       <input 
                                         type="file"
                                         accept="image/*"
                                         className="hidden"
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) handleDirectFileUpload(i, file);
                                         }}
                                       />
                                     </label>
                                     {img && (
                                       <button 
                                         type="button"
                                         onClick={() => setCroppingIndex(i)}
                                         className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase tracking-widest hover:underline"
                                       >
                                         <Crop className="w-3 h-3" /> {t('seller.edit_crop')}
                                       </button>
                                     )}
                                     {formData.images.length > 1 && (
                                       <button 
                                         type="button"
                                         onClick={() => removeImageField(i)}
                                         className="text-[10px] font-black text-red-500 flex items-center gap-1 uppercase tracking-widest hover:underline"
                                       >
                                         <Trash2 className="w-3 h-3" /> Remove
                                       </button>
                                     )}
                                  </div>
                                </div>
                              </div>
                              {moderationErrors[i] && (
                                <div className="mt-2 flex items-start gap-2 text-[10px] text-red-600 font-bold bg-white p-2 rounded-lg border border-red-100">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                  {moderationErrors[i]}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        <button 
                          type="button"
                          onClick={addImageField}
                          className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 hover:border-blue-100 hover:text-blue-500 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> {t('seller.add_manual')}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showSuggestions && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-blue-50/50 rounded-[32px] p-6 border border-blue-50"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                              {searchingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {t('seller.ai_image_suggestions')}
                            </p>
                            <button onClick={() => setShowSuggestions(false)} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
                          </div>
                          
                          {searchingImages ? (
                             <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(i => <div key={i} className="aspect-square bg-blue-100/50 animate-pulse rounded-xl" />)}
                             </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {imageSuggestions.map((s: any) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => selectSuggestion(s.url)}
                                  className="aspect-square rounded-xl overflow-hidden group relative"
                                >
                                  <img src={s.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                     <Plus className="w-6 h-6 text-white" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-4 mr-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('seller.key_features', 'Key Features')}</label>
                      <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Used by AI generator
                      </span>
                    </div>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold placeholder-gray-400 text-gray-900"
                      placeholder="Ex: Waterproof, Noise cancellation, 20h Battery, Bluetooth 5.3"
                      value={formData.keyFeatures}
                      onChange={(e) => setFormData({ ...formData, keyFeatures: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-4 mr-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Description</label>
                      <button 
                        type="button"
                        onClick={suggestDescription}
                        disabled={generating || !formData.name}
                        className="text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generating ? 'Generating...' : 'Suggest with AI'}
                      </button>
                    </div>
                    <textarea 
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium resize-none h-32"
                      placeholder="Tell customers about your product..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-50 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">Immediate Delivery</p>
                    <p className="text-xs text-gray-500">Enable if this item is ready for same-day delivery.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, deliveryAvailable: !formData.deliveryAvailable })}
                    className={`w-14 h-8 rounded-full relative transition-colors ${formData.deliveryAvailable ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${formData.deliveryAvailable ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 italic"
                >
                  {loading ? 'Adding Product...' : 'Publish Product Listing'}
                  <ArrowRight className="w-6 h-6" />
                </button>
              </form>
            </div>
          </motion.div>
          {croppingIndex !== null && (
            <ImageCropper 
              image={formData.images[croppingIndex]}
              onCancel={() => {
                const currentImg = formData.images[croppingIndex];
                if (currentImg && currentImg.startsWith('data:')) {
                  setFormData(prev => {
                    const nextImages = [...prev.images];
                    nextImages[croppingIndex] = '';
                    return { ...prev, images: nextImages };
                  });
                }
                setCroppingIndex(null);
              }}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
