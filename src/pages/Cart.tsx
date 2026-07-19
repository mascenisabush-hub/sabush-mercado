import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag, MessageSquare, Truck, MapPin, Loader2, CreditCard, Smartphone } from 'lucide-react';
import { Link, useNavigate } from '../components/common/RouteLink';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useNotifications } from '../context/NotificationContext';
import { formatCurrency, cn, getDistance } from '../lib/utils';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType, parseFirestoreError } from '../lib/firebaseErrors';
import { motion, AnimatePresence } from 'motion/react';
import { SavedAddress } from '../types';
import { PROVINCES } from '../constants';
import { EmptyState } from '../components/common/EmptyState';

export function Cart() {
  const { items, addToCart, removeFromCart, totalPrice, totalItems, clearCart } = useCart();
  const { user } = useAuth();
  const { location: userLocation, selectedCountry } = useLocation();
  const { profile } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'mpesa' | 'emola' | 'bank'>('cod');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.location || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [useSameForWhatsApp, setUseSameForWhatsApp] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validationError, setValidationError] = useState('');

  // Saved Delivery Addresses integration
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showInlineAddForm, setShowInlineAddForm] = useState(false);

  // Inline address form fields
  const [inlineLabel, setInlineLabel] = useState('');
  const [inlineFullName, setInlineFullName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineProvince, setInlineProvince] = useState('');
  const [inlineCity, setInlineCity] = useState('');
  const [inlineStreet, setInlineStreet] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'addresses'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedAddress));
      setSavedAddresses(list);
      
      // Pre-select default address automatically
      const defaultAddr = list.find(a => a.isDefault);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setDeliveryAddress(`${defaultAddr.fullName} (${defaultAddr.label}) - Tel: ${defaultAddr.phone}, ${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.province}`);
      } else if (list.length > 0) {
        setSelectedAddressId(list[0].id);
        const first = list[0];
        setDeliveryAddress(`${first.fullName} (${first.label}) - Tel: ${first.phone}, ${first.street}, ${first.city}, ${first.province}`);
      }
    });
    return () => unsub();
  }, [user]);

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setDeliveryAddress(`${addr.fullName} (${addr.label}) - Tel: ${addr.phone}, ${addr.street}, ${addr.city}, ${addr.province}`);
  };

  const handleSaveInlineAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!inlineLabel || !inlineFullName || !inlinePhone || !inlineProvince || !inlineCity || !inlineStreet) {
      alert("Please fill in all address fields.");
      return;
    }
    setInlineLoading(true);
    try {
      const isFirst = savedAddresses.length === 0;
      
      const addressData = {
        label: inlineLabel,
        fullName: inlineFullName,
        phone: inlinePhone,
        province: inlineProvince,
        city: inlineCity,
        street: inlineStreet,
        isDefault: isFirst
      };
      
      const newDocRef = await addDoc(collection(db, 'users', user.uid, 'addresses'), addressData);
      
      // Auto select the newly added address
      setSelectedAddressId(newDocRef.id);
      setDeliveryAddress(`${inlineFullName} (${inlineLabel}) - Tel: ${inlinePhone}, ${inlineStreet}, ${inlineCity}, ${inlineProvince}`);
      
      // Reset form fields
      setInlineLabel('');
      setInlineFullName('');
      setInlinePhone('');
      setInlineProvince('');
      setInlineCity('');
      setInlineStreet('');
      setShowInlineAddForm(false);
    } catch (err: any) {
      console.error("Error saving address inline: ", err);
      alert("Failed to save address: " + err.message);
    } finally {
      setInlineLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Looks like you haven't added anything to your cart yet. Browse our products and find something great!"
          ctaText="Go to Marketplace"
          ctaLink="/marketplace"
        />
      </div>
    );
  }

  const handleApplyCoupon = async (codeToApply: string) => {
    const code = codeToApply.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    setAppliedCoupon(null);

    // Demo fallbacks for seamless verification in preview mode
    const FALLBACK_COUPONS: Record<string, any> = {
      'MERCADO2026': { code: 'MERCADO2026', discountPercentage: 10, isActive: true, usageLimit: null, usageCount: 0, promotionId: '' },
      'FIRSTBUY': { code: 'FIRSTBUY', discountPercentage: 15, isActive: true, usageLimit: null, usageCount: 0, promotionId: '' }
    };

    try {
      const couponRef = doc(db, 'coupons', code);
      const couponSnap = await getDoc(couponRef);

      let couponData: any = null;

      if (couponSnap.exists()) {
        couponData = { id: couponSnap.id, ...couponSnap.data() };
      } else if (FALLBACK_COUPONS[code]) {
        couponData = FALLBACK_COUPONS[code];
      }

      if (!couponData) {
        setCouponError('Código de cupom inválido.');
        return;
      }

      if (!couponData.isActive) {
        setCouponError('Este cupom está desativado.');
        return;
      }

      if (couponData.expiryDate) {
        const expiry = new Date(couponData.expiryDate);
        if (expiry < new Date()) {
          setCouponError('Este cupom expirou.');
          return;
        }
      }

      if (couponData.usageLimit !== null && couponData.usageLimit !== undefined && couponData.usageCount >= couponData.usageLimit) {
        setCouponError('Este cupom atingiu o limite de utilização.');
        return;
      }

      // Valid coupon!
      setAppliedCoupon({
        code: couponData.id || couponData.code,
        promotionId: couponData.promotionId || '',
        discountPercent: couponData.discountPercentage,
        description: `${couponData.discountPercentage}% de desconto instantâneo`
      });
      setCouponError('');
    } catch (err) {
      console.error('Error validating coupon:', err);
      setCouponError('Erro ao validar o cupom no sistema.');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const freeShippingThreshold = 5000;
  
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountPercent) {
      discountAmount = totalPrice * (appliedCoupon.discountPercent / 100);
    } else if (appliedCoupon.discountFixed && totalPrice >= (appliedCoupon.minCart || 0)) {
      discountAmount = appliedCoupon.discountFixed;
    }
  }

  const subtotalWithDiscount = Math.max(0, totalPrice - discountAmount);
  const iva = subtotalWithDiscount * 0.17;
  const finalTotal = subtotalWithDiscount + iva;
  const savings = discountAmount;
  const isFreeShippingEligible = totalPrice >= freeShippingThreshold;

  const handleCheckout = async () => {
    setValidationError('');
    if (!user) {
      if (!guestName.trim()) {
        setValidationError("Por favor, introduza o seu Nome Completo para podermos processar o seu pedido.");
        return;
      }
      if (!guestPhone.trim()) {
        setValidationError("Por favor, introduza o seu Número de Telefone de contacto.");
        return;
      }
      const finalWhatsApp = useSameForWhatsApp ? guestPhone : guestWhatsapp;
      if (!finalWhatsApp.trim()) {
        setValidationError("Por favor, introduza o seu contacto de WhatsApp para que os vendedores possam falar consigo.");
        return;
      }
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      setValidationError("Por favor, introduza o seu Endereço de Entrega para receber os seus produtos.");
      return;
    }

    setCheckingOut(true);

    try {
      // For each item, find all sellers who have it and route to the nearest one
      // In this MVP, we match by product name
      const routedItems = await Promise.all(items.map(async (item) => {
        const q = query(collection(db, 'products'), where('name', '==', item.name));
        const querySnapshot = await getDocs(q);
        
        let nearestStoreId = item.storeId; // Fallback to current
        let minDistance = Infinity;

        if (!querySnapshot.empty && userLocation) {
          // Fetch store locations for all matches
          const matches = querySnapshot.docs.map(doc => doc.data());
          for (const match of matches) {
            const storeSnap = await getDoc(doc(db, 'stores', match.storeId));
            if (storeSnap.exists()) {
              const storeData = storeSnap.data();
              if (storeData.latitude && storeData.longitude) {
                const dist = getDistance(
                  userLocation.latitude, 
                  userLocation.longitude, 
                  storeData.latitude, 
                  storeData.longitude
                );
                if (dist < minDistance) {
                  minDistance = dist;
                  nearestStoreId = match.storeId;
                }
              }
            }
          }
        }
        
        return {
          ...item,
          routedStoreId: nearestStoreId,
          distance: minDistance === Infinity ? null : minDistance
        };
      }));

      // Create orders for each group of routedStoreId
      const storesToNotify = [...new Set(routedItems.map(i => i.routedStoreId))];
      
      const orders = [];
      const orderPath = 'orders';
      for (const storeId of storesToNotify) {
        const storeItems = routedItems.filter(i => i.routedStoreId === storeId);
        try {
          const orderRef = await addDoc(collection(db, orderPath), {
            customerId: user?.uid || null,
            customerName: user ? (profile?.displayName || user.displayName || 'Cliente Registado') : null,
            customerPhone: user ? (profile?.phoneNumber || phoneNumber || '') : null,
            customerEmail: user ? (profile?.email || user.email || '') : null,
            guestEmail: user ? null : (guestEmail || null),
            guestName: user ? null : guestName,
            guestPhone: user ? null : guestPhone,
            guestWhatsapp: user ? null : (useSameForWhatsApp ? guestPhone : guestWhatsapp),
            isGuest: !user,
            storeId,
            items: storeItems.map(item => ({
              productId: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.images[0],
              selectedColor: item.selectedColor,
              selectedSize: item.selectedSize
            })),
            totalAmount: storeItems.reduce((acc: number, curr) => acc + (curr.price * curr.quantity), 0),
            status: 'pending',
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending', // Will update after API call
            deliveryMethod,
            deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
            whatsappContacted: false,
            country: selectedCountry.code,
            currency: selectedCountry.currency,
            createdAt: new Date().toISOString(),
            customerLocation: userLocation || null
          });
          orders.push({ id: orderRef.id, storeId });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, orderPath);
        }
      }

      // If electronic payment selected, call simulated server side payment
      if (paymentMethod !== 'cod') {
        const methodMap = {
          mpesa: 'M-Pesa',
          emola: 'e-Mola',
          bank: 'Bank Transfer'
        };

        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/payments/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            method: methodMap[paymentMethod as keyof typeof methodMap],
            phoneNumber: phoneNumber,
            amount: finalTotal, // Include IVA in processing
            orderIds: orders.map(o => o.id),
            customerName: user?.displayName || guestName
          })
        });
        
        const result = await response.json();
        if (!response.ok || result.status === 'failed' || result.status === 'error') {
          throw new Error(result.message || `${paymentMethod} payment failed`);
        }

        // Update payment status in Firestore for all orders
        for (const order of orders) {
          await updateDoc(doc(db, 'orders', order.id), {
            paymentStatus: paymentMethod === 'bank' ? 'pending_confirmation' : 'paid',
            paymentSimulated: true,
            gatewayReference: result.gatewayReference,
            transactionId: result.transactionId
          });
        }

        // Notify user of successful initiation/payment
        await sendNotification(
          user?.uid || 'guest', 
          'Payment Initiated', 
          result.message || `Your payment via ${methodMap[paymentMethod as keyof typeof methodMap]} is being processed.`, 
          paymentMethod
        );
      }

      // Notify sellers (simulated by adding to notifications collection)
      for (const order of orders) {
        // Find seller UID
        const storeSnap = await getDoc(doc(db, 'stores', order.storeId));
        if (storeSnap.exists()) {
          const sellerId = storeSnap.data().ownerId;
          await sendNotification(
            sellerId,
            'New Order Received!',
            `A new order of ${formatCurrency(totalPrice)} is waiting for your confirmation.`,
            'order'
          );
        }
      }

      if (appliedCoupon) {
        try {
          const couponDocRef = doc(db, 'coupons', appliedCoupon.code);
          const couponSnap = await getDoc(couponDocRef);
          if (couponSnap.exists()) {
            const currentCount = couponSnap.data().usageCount || 0;
            await updateDoc(couponDocRef, {
              usageCount: currentCount + 1
            });
          }

          if (appliedCoupon.promotionId) {
            const promotionDocRef = doc(db, 'promotions', appliedCoupon.promotionId);
            const promotionSnap = await getDoc(promotionDocRef);
            if (promotionSnap.exists()) {
              const currentUsage = promotionSnap.data().usageCount || 0;
              await updateDoc(promotionDocRef, {
                usageCount: currentUsage + 1
              });
            }
          }
        } catch (couponIncErr) {
          console.error("Error updating coupon/promotion usage counts:", couponIncErr);
        }
      }

      clearCart();
      navigate('/order-success');
    } catch (error: any) {
      console.error("Checkout error:", error);
      setValidationError(parseFirestoreError(error));
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900">Shopping Cart ({totalItems})</h1>
        {userLocation && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-full font-bold border border-blue-100 italic">
            <MapPin className="w-4 h-4" /> Routing optimized for your location
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-4 sm:p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-6 relative group">
              <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <Link to={`/product/${item.id}`}>
                      <h3 className="font-bold text-gray-900 text-lg hover:text-blue-600 transition-colors">{item.name}</h3>
                    </Link>
                    <button 
                      onClick={() => removeFromCart(item.id, item.selectedColor, item.selectedSize)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mb-1">{item.category}</p>
                  
                  {(item.selectedColor || item.selectedSize) && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {item.selectedColor && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md text-[10px] font-bold text-gray-600">
                          <div className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: item.selectedColor.toLowerCase() }} />
                          {item.selectedColor}
                        </span>
                      )}
                      {item.selectedSize && (
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-bold text-gray-600">
                          {item.selectedSize}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">Selected Store: <span className="text-gray-700 font-bold">Tech Hub Store</span></p>
                  {userLocation && (
                    <p className="text-[10px] text-green-600 font-bold uppercase mt-2 bg-green-50 inline-block px-2 py-1 rounded-md">
                      Smart-routing enabled: Closest seller will be notified
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4">
                   <p className="text-xl font-black text-gray-900 leading-none">
                     {formatCurrency(item.price, selectedCountry.currency).split(',')[0]} <span className="text-xs">{selectedCountry.currency}</span>
                   </p>
                    <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                       <button 
                         onClick={() => removeFromCart(item.id, item.selectedColor, item.selectedSize)} 
                         className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600"
                       >
                         <Minus className="w-4 h-4" />
                       </button>
                       <span className="w-8 text-center font-bold text-gray-900">{item.quantity}</span>
                       <button 
                         onClick={() => addToCart(item, 1, item.selectedColor, item.selectedSize)}
                         className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:w-full space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm sticky top-24">
            <h3 className="text-xl font-black text-gray-900 mb-8 tracking-tight uppercase">Order Summary</h3>
            
            {!user && (
              <div className="mb-8 p-6 bg-blue-50/70 rounded-3xl border border-blue-100">
                <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-3 italic">Finalize sem criar conta (Guest)</p>
                <p className="text-[11px] text-gray-500 mb-4 font-semibold">Os vendedores entrarão em contacto consigo via WhatsApp para agendar a entrega.</p>
                <div className="space-y-4 font-sans">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Nome Completo *</label>
                    <input 
                      type="text" 
                      placeholder="Como deseja ser chamado(a)?"
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Contacto de Telefone *</label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 84 / 86 / 87xxxxxxx"
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox" 
                      id="sameForWhatsapp" 
                      checked={useSameForWhatsApp}
                      onChange={(e) => setUseSameForWhatsApp(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="sameForWhatsapp" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                      O WhatsApp é o mesmo número
                    </label>
                  </div>

                  {!useSameForWhatsApp && (
                    <div className="space-y-1 transition-all duration-300">
                      <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 animate-fade-in">Contacto de WhatsApp *</label>
                      <input 
                        type="tel" 
                        placeholder="Ex: +258 84xxxxxxx"
                        className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={guestWhatsapp}
                        onChange={(e) => setGuestWhatsapp(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Endereço de E-mail</label>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black mr-1">Opcional, mas recomendado</span>
                    </div>
                    <input 
                      type="email" 
                      placeholder="seuemail@exemplo.com"
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-blue-100"></div></div>
                  <div className="relative flex justify-center text-[10px] font-black uppercase text-blue-400 bg-blue-50 px-2 tracking-widest">Ou Poupe Tempo</div>
                </div>

                <Link to="/login?redirect=cart" className="block w-full py-3 bg-white border-2 border-dashed border-blue-300 text-blue-600 text-center rounded-xl font-bold text-xs hover:bg-blue-50 transition-all shadow-sm">
                   Iniciar Sessão / Criar Conta
                </Link>
              </div>
            )}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between text-gray-500">
              {/* Free Shipping Tracker and Coupon Simulator */}
              <div className="space-y-6 mb-8 border-b border-gray-100 pb-6">
                {/* 1. Free Shipping Threshold Tracker */}
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-150/40">
                  <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-2">
                    <span className="text-gray-500">Portes Grátis / Free Delivery</span>
                    <span className={isFreeShippingEligible ? "text-emerald-600 font-extrabold" : "text-blue-600"}>
                      {isFreeShippingEligible ? "Elegível!" : `${Math.round((totalPrice / freeShippingThreshold) * 100)}%`}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden mb-3.5 shadow-inner">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isFreeShippingEligible ? "bg-emerald-500" : "bg-blue-600 animate-pulse"
                      )}
                      style={{ width: `${Math.min(100, (totalPrice / freeShippingThreshold) * 100)}%` }}
                    />
                  </div>

                  {isFreeShippingEligible ? (
                    <p className="text-[10px] text-emerald-700 font-black uppercase tracking-wider flex items-center gap-1.5 leading-snug animate-bounce">
                      ★ Parabéns! Portes gratuitos assegurados para este pedido.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-bold leading-normal">
                      Falta apenas <span className="text-blue-600 font-black">{formatCurrency(freeShippingThreshold - totalPrice)}</span> para obter Entrega Gratuita nacional!
                    </p>
                  )}
                </div>

                {/* 2. Coupon Applied indicator & Interactive simulator grid */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Simulador de Cupons</p>
                  
                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { code: 'MERCADO2026', description: '10% de desconto no total' },
                      { code: 'FIRSTBUY', description: '15% de desconto de Boas-vindas' }
                    ].map((coupon) => {
                      const isActive = appliedCoupon?.code === coupon.code;
                      return (
                        <button
                          key={coupon.code}
                          type="button"
                          onClick={() => isActive ? handleRemoveCoupon() : handleApplyCoupon(coupon.code)}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                            isActive 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-300 shadow-md shadow-emerald-50 scale-105 animate-pulse" 
                              : "bg-white text-gray-400 border-gray-150 hover:text-blue-600 hover:border-blue-300"
                          )}
                          title={coupon.description}
                        >
                          {coupon.code}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual Input form */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold uppercase placeholder:text-gray-300"
                      placeholder="Introduza código..."
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(couponCode)}
                      className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-black"
                    >
                      Aplicar
                    </button>
                  </div>

                  {couponError && (
                    <p className="text-[9px] text-red-600 font-black uppercase tracking-wider leading-snug ml-1">
                      ⚠️ {couponError}
                    </p>
                  )}

                  {appliedCoupon && (
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-150 flex items-center justify-between text-xs font-black text-emerald-800 leading-snug">
                      <div>
                        <span>Código Ativo: <strong className="text-emerald-950 uppercase">{appliedCoupon.code}</strong></span>
                        <p className="text-[9px] font-medium text-emerald-700 mt-0.5">{appliedCoupon.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>

                   <span className="font-medium text-sm">Subtotal (Excl. VAT)</span>
                   <span className="font-black text-gray-900">{formatCurrency(totalPrice)}</span>
                </div>

                {appliedCoupon && (
                  <>
                    <div className="flex items-center justify-between text-emerald-600 font-extrabold text-xs uppercase tracking-wider py-1.5 border-t border-dashed border-gray-100">
                       <span>Desconto Cupom ({appliedCoupon.code})</span>
                       <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500 font-semibold text-xs pt-1">
                       <span>Subtotal com Desconto</span>
                       <span className="text-gray-700 font-black">{formatCurrency(subtotalWithDiscount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-gray-500">
                   <span className="font-medium text-sm">IVA (17%)</span>
                   <span className="font-black text-gray-900">{formatCurrency(iva)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                   <span className="font-medium text-sm">Delivery Fee</span>
                   <span className="font-bold text-green-600">
                     {deliveryMethod === 'pickup' ? 'FREE' : isFreeShippingEligible ? 'FREE (Portes Grátis)' : 'Calculated at confirm'}
                   </span>
                </div>

                {appliedCoupon && (
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-150/40 text-[10px] font-black uppercase tracking-widest text-emerald-800 flex items-center justify-between shadow-inner">
                     <span>Economia Total neste pedido:</span>
                     <span>{formatCurrency(savings)}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                   <span className="text-lg font-bold text-gray-900">Total</span>
                   <span className="text-2xl font-black text-blue-600">{formatCurrency(finalTotal)}</span>
                </div>
             </div>

            <div className="mb-8 p-6 bg-gray-50 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-gray-400 gap-2 flex items-center uppercase tracking-widest">
                <Truck className="w-3 h-3" /> Delivery Method
              </h4>
              <div className="flex p-1 bg-white rounded-2xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all",
                    deliveryMethod === 'delivery' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-400"
                  )}
                >
                  Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all",
                    deliveryMethod === 'pickup' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-400"
                  )}
                >
                  Pick-up
                </button>
              </div>

              {deliveryMethod === 'delivery' ? (
                <div className="space-y-4 text-left">
                  {user ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-905 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-blue-600 animate-pulse" />
                          Delivery Address Selection
                        </label>
                        {!showInlineAddForm && savedAddresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowInlineAddForm(true)}
                            className="text-[11px] font-black uppercase text-blue-600 hover:text-blue-750 tracking-wider hover:underline"
                          >
                            + Add New Address
                          </button>
                        )}
                      </div>

                      {/* Prompt to add one if first-time buyer with no saved addresses */}
                      {savedAddresses.length === 0 && !showInlineAddForm ? (
                        <div className="p-6 border border-dashed border-gray-250 rounded-[32px] text-center bg-gray-50/50 space-y-3">
                          <MapPin className="w-8 h-8 text-blue-500 mx-auto animate-bounce" />
                          <h4 className="text-sm font-black text-gray-800">First-time Buyer? Save an Address</h4>
                          <p className="text-xs text-gray-405 max-w-sm mx-auto font-semibold leading-relaxed">
                            It looks like you don't have any saved delivery details yet. Add one now to continue and enjoy 1-click checkouts next time.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowInlineAddForm(true)}
                            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-blue-100"
                          >
                            + Add Delivery Address
                          </button>
                        </div>
                      ) : null}

                      {/* Inline Add Address Form in checkout flow */}
                      <AnimatePresence>
                        {showInlineAddForm && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-5 bg-gray-50 border border-gray-150 rounded-3xl space-y-4 text-left overflow-hidden"
                          >
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Add New Delivery Location</h5>
                              <button
                                type="button"
                                onClick={() => setShowInlineAddForm(false)}
                                className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Label (Home, Office, etc.)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Home"
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlineLabel}
                                  onChange={(e) => setInlineLabel(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Receiver Full Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. John Doe"
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlineFullName}
                                  onChange={(e) => setInlineFullName(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Contact Phone</label>
                                <input
                                  type="tel"
                                  placeholder="e.g. 841234567"
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlinePhone}
                                  onChange={(e) => setInlinePhone(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Province</label>
                                <select
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlineProvince}
                                  onChange={(e) => setInlineProvince(e.target.value)}
                                >
                                  <option value="">-- Select Province --</option>
                                  {PROVINCES.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">City</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Maputo"
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlineCity}
                                  onChange={(e) => setInlineCity(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Street / Neighborhood</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Av. Julius Nyerere, 123"
                                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                  value={inlineStreet}
                                  onChange={(e) => setInlineStreet(e.target.value)}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleSaveInlineAddress}
                              disabled={inlineLoading}
                              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50"
                            >
                              {inlineLoading ? 'Saving Address...' : 'Save & Select Address'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Selectable address list */}
                      {savedAddresses.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {savedAddresses.map((addr) => {
                            const isSelected = selectedAddressId === addr.id;
                            return (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => handleSelectAddress(addr)}
                                className={cn(
                                  "p-5 rounded-[24px] border text-left transition-all relative flex flex-col justify-between w-full select-none cursor-pointer",
                                  isSelected 
                                    ? "border-blue-600 bg-blue-50/15 shadow-sm" 
                                    : "border-gray-150 bg-white hover:border-gray-300"
                                )}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className={cn(
                                      "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                      isSelected ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
                                    )}>
                                      {addr.label}
                                    </span>
                                    {addr.isDefault && (
                                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                        Default
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-0.5">
                                    <p className="text-xs font-black text-gray-900">{addr.fullName}</p>
                                    <p className="text-[11px] font-bold text-gray-400">{addr.phone}</p>
                                    <p className="text-[11px] text-gray-500 mt-1.5 font-medium leading-relaxed line-clamp-2">
                                      {addr.street}, {addr.city}, {addr.province}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Guest checkout fallback
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                        <div className="text-left">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Register for Premium Checkout</p>
                          <p className="text-[11px] font-semibold text-blue-500 leading-tight">Create an account or log in to use Saved Delivery Addresses and speed up your orders.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/auth')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                        >
                          Sign In / Register
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Delivery Address</label>
                        <textarea
                          placeholder="Enter your full street address, house number, neighborhood, and city..."
                          required
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-150 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium resize-none h-24 shadow-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-blue-50 rounded-3xl border border-blue-100 text-left">
                  <p className="text-[11px] text-blue-800 font-bold leading-relaxed flex items-start gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    You will need to go to the seller's physical shop location to pick up your items. Shop coordinates and contact details will be shared right after confirmation.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-8">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Payment Method</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    paymentMethod === 'cod' ? "border-blue-600 bg-blue-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <Truck className={cn("w-6 h-6", paymentMethod === 'cod' ? "text-blue-600" : "text-gray-400")} />
                  <span className={cn("text-[10px] font-black uppercase text-center", paymentMethod === 'cod' ? "text-blue-600" : "text-gray-400")}>Dinheiro (Cash on Delivery)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    paymentMethod === 'bank' ? "border-indigo-600 bg-indigo-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <CreditCard className={cn("w-6 h-6", paymentMethod === 'bank' ? "text-indigo-600" : "text-gray-400")} />
                  <span className={cn("text-[10px] font-black uppercase text-center", paymentMethod === 'bank' ? "text-indigo-600" : "text-gray-400")}>Banco / Transferência</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mpesa')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    paymentMethod === 'mpesa' ? "border-red-600 bg-red-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-black italic">M</div>
                  <span className={cn("text-[10px] font-black uppercase", paymentMethod === 'mpesa' ? "text-red-600" : "text-gray-400")}>M-Pesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('emola')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                    paymentMethod === 'emola' ? "border-orange-600 bg-orange-50" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-black italic">e</div>
                  <span className={cn("text-[10px] font-black uppercase", paymentMethod === 'emola' ? "text-orange-600" : "text-gray-400")}>e-Mola</span>
                </button>
              </div>

              {(paymentMethod === 'mpesa' || paymentMethod === 'emola') && (
                <div className="mt-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    placeholder={paymentMethod === 'emola' ? "86/87xxxxxxx" : "84xxxxxxx"}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:bg-white transition-all text-sm font-bold",
                      paymentMethod === 'emola' ? "focus:ring-orange-500" : "focus:ring-red-500"
                    )}
                  />
                </div>
              )}

               {paymentMethod === 'bank' && (
                <div className="mt-4 bg-green-50 p-4 rounded-xl border border-green-100 space-y-2">
                  <p className="text-[10px] text-green-800 font-black uppercase tracking-tight">Dados Bancários - Pagamento Antecipado</p>
                  <div className="text-[10px] text-green-700 font-bold">
                    <p>Banco: Millennium bim / BCI / Standard Bank</p>
                    <p>NUIT da Empresa: (Enviado após pedido)</p>
                    <p>Anexe o comprovativo no Chat WhatsApp.</p>
                  </div>
                </div>
              )}

              {paymentMethod === 'mpesa' && (
                <div className="mt-4 bg-red-50 p-4 rounded-xl border border-red-100 space-y-2">
                  <p className="text-[10px] text-red-800 font-black uppercase tracking-tight">Instruções M-Pesa</p>
                  <p className="text-[10px] text-red-700 font-bold italic">
                    Irá receber o pedido de confirmação (PIN) no seu telemóvel.
                  </p>
                </div>
              )}
              
              {paymentMethod === 'emola' && (
                <div className="mt-4 bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-2">
                  <p className="text-[10px] text-orange-800 font-black uppercase tracking-tight">Instruções e-Mola</p>
                  <p className="text-[10px] text-orange-700 font-bold italic">
                    Pagamento via rede Movitel. O processo de confirmação será enviado.
                  </p>
                </div>
              )}
            </div>

            {validationError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2 animate-shake">
                <span className="text-sm">⚠️</span>
                <span>{validationError}</span>
              </div>
            )}

            <button 
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {checkingOut ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Placing Order...
                </>
              ) : (
                'Checkout Order'
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest">
              Secured Checkout by Mercado Sabush
            </p>

            <div className="mt-8 pt-8 border-t border-gray-100 space-y-4">
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Truck className="w-5 h-5 text-blue-500" />
                  <span>Free delivery on orders above {formatCurrency(50000, selectedCountry.currency)}</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-gray-600">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <span>Sellers will contact you via WhatsApp</span>
               </div>
               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[11px] text-blue-800 font-bold leading-relaxed">
                    🚀 <strong>Smart-Routing:</strong> We automatically notify the seller physically closest to you to ensure lightning-fast delivery!
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
