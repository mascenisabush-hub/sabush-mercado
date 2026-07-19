import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, setDoc, collectionGroup, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Package, ShoppingCart, Settings, Plus, Star, 
  TrendingUp, Users, ArrowRight, Trash2, Edit, Store as StoreIcon,
  CheckCircle, Clock, AlertTriangle, ChevronRight, Upload, Loader2,
  LogOut, MapPin, Sliders, ArrowLeft, FileSpreadsheet, Download, HelpCircle,
  Lock, Eye, EyeOff, X, Award, Wallet, Landmark, Receipt, Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useLocation } from '../context/LocationContext';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AddProductModal } from '../components/modals/AddProductModal';
import { ManageVariantsModal } from '../components/modals/ManageVariantsModal';
import { ImportCSVModal } from '../components/modals/ImportCSVModal';
import { Product, Store, Order, Promotion, Coupon } from '../types';
import { handleOrderPayout } from '../lib/payouts';
import { handleFirestoreError, OperationType, parseFirestoreError } from '../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { getTranslatedField } from '../lib/i18nUtils';
import { CATEGORIES } from '../constants';
import { Skeleton, StoreSkeleton } from '../components/common/Skeleton';
import { useNavigate } from '../components/common/RouteLink';
import { calculateStoreChatStats, calculateStoreOrderStats } from '../lib/trustSignals';
import { OrderProgressSteps } from '../components/common/OrderProgressSteps';
import { compressImage } from '../lib/imageCompression';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';

async function hashPW(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function SellerDashboard() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const { location: appLocation, requestLocation, selectedCountry } = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'rfqs' | 'settings' | 'qas' | 'promotions' | 'finance'>('overview');
  
  // Finance Section States
  const [payoutSummary, setPayoutSummary] = useState<any | null>(null);
  const [payoutTransactions, setPayoutTransactions] = useState<any[]>([]);
  const [financeCurrency, setFinanceCurrency] = useState<'MZN' | 'USD' | 'ZAR'>('MZN');
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<'mpesa' | 'bank' | 'emola'>('mpesa');
  const [withdrawalAccount, setWithdrawalAccount] = useState('');
  const [withdrawalSubmitStatus, setWithdrawalSubmitStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const formatFinanceCurrency = (amount: number, curr: string) => {
    if (curr === 'MZN') {
      return new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        currencyDisplay: 'symbol'
      }).format(amount).replace('MZN', 'MT');
    }
    return new Intl.NumberFormat(curr === 'USD' ? 'en-US' : 'en-ZA', {
      style: 'currency',
      currency: curr,
      currencyDisplay: 'narrowSymbol'
    }).format(amount);
  };

  const getConvertedAmount = (amount: number, fromCurrency: string) => {
    if (!amount) return 0;
    if (fromCurrency === financeCurrency) return amount;
    
    let amountInMZN = amount;
    if (fromCurrency === 'USD') amountInMZN = amount * 63.8;
    else if (fromCurrency === 'ZAR') amountInMZN = amount * 3.5;
    
    if (financeCurrency === 'MZN') return amountInMZN;
    if (financeCurrency === 'USD') return amountInMZN / 63.8;
    if (financeCurrency === 'ZAR') return amountInMZN / 3.5;
    return amount;
  };

  const getCommissionRate = (storeObj: any): number => {
    if (storeObj?.commissionRate !== undefined && storeObj?.commissionRate !== null) {
      return Number(storeObj.commissionRate);
    }
    if (storeObj?.subscriptionPlan) {
      const planName = String(storeObj.subscriptionPlan).toLowerCase();
      if (planName === 'premium') return 5;
      if (planName === 'gold') return 7.5;
      if (planName === 'enterprise') return 3;
    }
    return 10;
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutSummary || !store?.ownerId) return;
    const amountNum = Number(withdrawalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Por favor, introduza um valor válido para solicitar levantamento.");
      return;
    }
    if (amountNum > payoutSummary.availableBalance) {
      alert("Saldo insuficiente para efetuar este levantamento.");
      return;
    }
    
    setWithdrawalSubmitStatus('submitting');
    try {
      const reqId = `with_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(doc(db, 'withdrawalRequests', reqId), {
        id: reqId,
        sellerId: store.ownerId,
        amount: amountNum,
        currency: payoutSummary.currency || 'MZN',
        status: 'pending',
        paymentMethod: withdrawalMethod,
        accountDetails: withdrawalAccount,
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        adminNote: ''
      });
      
      await updateDoc(doc(db, 'payouts', store.ownerId), {
        availableBalance: payoutSummary.availableBalance - amountNum,
        totalPending: (payoutSummary.totalPending || 0) + amountNum,
        lastUpdated: new Date().toISOString()
      });

      setWithdrawalSubmitStatus('success');
      
    } catch (err) {
      console.error(err);
      alert("Erro ao submeter levantamento: " + parseFirestoreError(err));
      setWithdrawalSubmitStatus('idle');
    }
  };
  const [dashboardPeriod, setDashboardPeriod] = useState<'7days' | '14days' | '30days'>('14days');
  const [dashboardMetric, setDashboardMetric] = useState<'both' | 'revenue' | 'volume'>('both');
  const [analyticsRange, setAnalyticsRange] = useState<'7days' | '30days' | '90days' | 'all'>('30days');
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    if (store?.id) {
      setIsAnalyticsLoading(true);
      const timer = setTimeout(() => {
        setIsAnalyticsLoading(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [store?.id, analyticsRange]);
  
  const [liveTrust, setLiveTrust] = useState<{
    responseRate: number;
    averageResponseTime: string;
    fulfillmentRate: number;
    totalSales: number;
  } | null>(null);

  useEffect(() => {
    if (!store?.id) {
      setLiveTrust(null);
      return;
    }
    const currentStore = store; // Narrowed to non-null for use inside the nested async function below
    async function loadLiveTrust() {
      try {
        const chatStats = await calculateStoreChatStats(currentStore.ownerId);
        const orderStats = await calculateStoreOrderStats(currentStore.id);
        setLiveTrust({
          responseRate: currentStore.responseRate !== undefined ? currentStore.responseRate : chatStats.responseRate,
          averageResponseTime: currentStore.averageResponseTime !== undefined ? currentStore.averageResponseTime : chatStats.averageResponseTimeText,
          fulfillmentRate: currentStore.fulfillmentRate !== undefined ? currentStore.fulfillmentRate : orderStats.fulfillmentRate,
          totalSales: currentStore.totalSales !== undefined ? currentStore.totalSales : orderStats.totalSales
        });
      } catch (e) {
        console.error("Live trust load error: ", e);
      }
    }
    loadLiveTrust();
  }, [store?.id]);

  useEffect(() => {
    if (!store?.ownerId) {
      setPayoutSummary(null);
      setPayoutTransactions([]);
      return;
    }

    const summaryRef = doc(db, 'payouts', store.ownerId);
    const unsubSummary = onSnapshot(summaryRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPayoutSummary(data);
        if (data.currency && !financeCurrency) {
          setFinanceCurrency(data.currency);
        }
      } else {
        setPayoutSummary({
          sellerId: store.ownerId,
          totalEarned: 0,
          totalPending: 0,
          totalWithdrawn: 0,
          availableBalance: 0,
          currency: 'MZN',
          lastUpdated: new Date().toISOString()
        });
      }
    }, (error) => {
      console.error("Error subscribing to payout summary:", error);
    });

    const txsRef = collection(db, 'payouts', store.ownerId, 'transactions');
    const unsubTxs = onSnapshot(txsRef, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side by date descending
      docs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPayoutTransactions(docs);
    }, (error) => {
      console.error("Error subscribing to transactions:", error);
    });

    return () => {
      unsubSummary();
      unsubTxs();
    };
  }, [store?.ownerId]);

  // Multiple Shops & Auth States
  const [myStores, setMyStores] = useState<Store[]>([]);
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({
    businessName: '',
    category: '',
    offeringType: 'products' as 'products' | 'services' | 'both',
    description: '',
    password: '',
    whatsappNumber: '',
    province: '',
    district: '',
    deliveryOptions: 'both' as 'pickup' | 'delivery' | 'both'
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [storeToEnter, setStoreToEnter] = useState<Store | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSettingPasswordForLegacy, setIsSettingPasswordForLegacy] = useState(false);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);

  // Product Editing States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    purchasingPrice: '',
    unitCxStock: '0',
    unitEmbStock: '0',
    unitUnStock: '0',
    category: '',
    imageUrl: ''
  });
  const [editWholesaleTiers, setEditWholesaleTiers] = useState<{minQuantity: string, price: string}[]>([]);

  const addEditTier = () => {
    setEditWholesaleTiers([...editWholesaleTiers, { minQuantity: '', price: '' }]);
  };

  const removeEditTier = (index: number) => {
    setEditWholesaleTiers(editWholesaleTiers.filter((_, i) => i !== index));
  };

  const updateEditTier = (index: number, field: 'minQuantity' | 'price', value: string) => {
    setEditWholesaleTiers(prev => prev.map((tier, i) => i === index ? { ...tier, [field]: value } : tier));
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [qas, setQas] = useState<any[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Promotions & Coupons states
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isPromotionsLoading, setIsPromotionsLoading] = useState(true);
  const [promoType, setPromoType] = useState<'discount' | 'flash_sale' | 'bundle' | 'coupon'>('discount');
  const [promoLabel, setPromoLabel] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number>(15);
  const [promoProducts, setPromoProducts] = useState<string[]>([]);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoUsageLimit, setPromoUsageLimit] = useState<string>('');

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponPromotionId, setCouponPromotionId] = useState('');
  const [customCouponCode, setCustomCouponCode] = useState('');
  const [couponUsageLimit, setCouponUsageLimit] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [locating, setLocating] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    whatsappNumber: '',
    description: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (store) {
      setSettingsForm({
        whatsappNumber: store.whatsappNumber || '',
        description: store.description || '',
        location: store.location || '',
        latitude: store.latitude || null,
        longitude: store.longitude || null
      });
    }
  }, [store]);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      await requestLocation();
      if (appLocation) {
        setSettingsForm(prev => ({
          ...prev,
          latitude: appLocation.latitude,
          longitude: appLocation.longitude,
          location: prev.location || `Lat: ${appLocation.latitude.toFixed(4)}, Lng: ${appLocation.longitude.toFixed(4)}`
        }));
      }
    } catch (err) {
      console.error("Location error:", err);
    } finally {
      setLocating(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!store) return;
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        whatsappNumber: settingsForm.whatsappNumber,
        description: settingsForm.description,
        location: settingsForm.location,
        latitude: settingsForm.latitude,
        longitude: settingsForm.longitude
      });
      alert('Settings saved successfully!');
    } catch (error) {
      alert(parseFirestoreError(error));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (!user || !store) return;
    setLogoError(null);

    // 1. Ensure it only allows image MIME types
    if (!file.type.startsWith('image/')) {
      setLogoError(t('seller.logo_type_error', 'Apenas são permitidas imagens (PNG, JPG, JPEG, WEBP). / Only images are allowed.'));
      return;
    }

    // 2. Validate file size (under 2MB, i.e., 2 * 1024 * 1024 bytes)
    const MAX_SIZE_MB = 2;
    const maxSizeBytes = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setLogoError(t('seller.logo_size_error', 'O arquivo é muito grande. O tamanho máximo permitido é de 2 MB. / File is too large. Max size is 2MB.'));
      return;
    }

    setUploadingLogo(true);
    try {
      const compressedFile = await compressImage(file, { maxDimension: 800, quality: 0.85 });
      const storageRef = ref(storage, `stores/${user.uid}/logo_${Date.now()}`);
      await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'stores', store.id), {
        logo: downloadURL
      });
      setLogoError(null);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setLogoError(t('seller.logo_upload_failed', 'Falha ao carregar o logótipo. Por favor, tente novamente. / Failed to upload logo.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleLogoFile(file);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Listen to ALL Stores owned by the user
    const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', user.uid));
    const unsubscribeStores = onSnapshot(storesQuery, (snapshot) => {
      const storeList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Store));
      setMyStores(storeList);
      
      // If there's an active selected store, keep it updated in real-time
      setStore(prevStore => {
        if (!prevStore) return null;
        const updated = storeList.find(s => s.id === prevStore.id);
        return updated || null;
      });
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
      setLoading(false);
    });

    return () => unsubscribeStores();
  }, [user]);

  useEffect(() => {
    if (!user || !store) {
      setProducts([]);
      setOrders([]);
      setRfqs([]);
      setQas([]);
      return;
    }

    // Listen to Products for THIS specific store
    const productsQuery = query(collection(db, 'products'), where('storeId', '==', store.id));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    // Listen to Orders for THIS specific store
    const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', store.id));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Order[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Listen to RFQs for THIS specific store
    const rfqsQuery = query(collection(db, 'rfqs'), where('storeId', '==', store.id));
    const unsubscribeRfqs = onSnapshot(rfqsQuery, (snapshot) => {
      setRfqs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rfqs'));

    // Listen to Q&As for THIS specific store
    const qasQuery = query(collection(db, 'qas'), where('storeId', '==', store.id));
    const unsubscribeQas = onSnapshot(qasQuery, (snapshot) => {
      setQas(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (error) => {
      console.warn("Q&As subscription indexing:", error);
    });

    // Listen to Promotions for THIS specific seller
    const promotionsQuery = query(collection(db, 'promotions'), where('sellerId', '==', user.uid));
    const unsubscribePromotions = onSnapshot(promotionsQuery, (snapshot) => {
      const currentDate = new Date();
      setPromotions(snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        const isExpired = new Date(data.endDate) < currentDate;
        return {
          ...data,
          id: docSnap.id,
          isActive: data.isActive && !isExpired // auto-expire without seller manual action
        } as Promotion;
      }));
      setIsPromotionsLoading(false);
    }, (error) => {
      console.error("error loading promotions", error);
      setIsPromotionsLoading(false);
    });

    // Listen to Coupons
    const couponsQuery = query(collection(db, 'coupons'));
    const unsubscribeCoupons = onSnapshot(couponsQuery, (snapshot) => {
      setCoupons(snapshot.docs.map(docSnap => ({ ...docSnap.data() } as Coupon)));
    }, (error) => {
      console.error("error loading coupons", error);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeRfqs();
      unsubscribeQas();
      unsubscribePromotions();
      unsubscribeCoupons();
    };
  }, [user, store]);

  // --- Promotion Handlers ---
  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !store) return;
    if (!promoLabel) {
      alert('Por favor introduza uma etiqueta/nome para a promoção.');
      return;
    }
    if (promoDiscount <= 0 || promoDiscount > 100) {
      alert('A percentagem de desconto deve ser entre 1% e 100%');
      return;
    }
    if (!promoStartDate || !promoEndDate) {
      alert('Por favor defina as datas de início e fim da promoção.');
      return;
    }
    if (new Date(promoStartDate) > new Date(promoEndDate)) {
      alert('A data de início não pode ser posterior à data de fim.');
      return;
    }
    if (promoProducts.length === 0) {
      alert('Por favor selecione pelo menos um produto.');
      return;
    }

    try {
      const id = 'promo_' + Math.random().toString(36).substr(2, 9);
      const limitVal = promoUsageLimit ? parseInt(promoUsageLimit, 10) : null;
      
      const newPromo: Promotion = {
        id,
        sellerId: user.uid,
        type: promoType,
        label: promoLabel,
        discountPercentage: Number(promoDiscount),
        applicableProductIds: promoProducts,
        startDate: promoStartDate,
        endDate: promoEndDate,
        isActive: true,
        usageLimit: limitVal,
        usageCount: 0
      };

      await setDoc(doc(db, 'promotions', id), newPromo);
      
      // Reset form
      setPromoLabel('');
      setPromoDiscount(15);
      setPromoProducts([]);
      setPromoStartDate('');
      setPromoEndDate('');
      setPromoUsageLimit('');
      alert('Promoção criada com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'promotions');
    }
  };

  const handleDeactivatePromotion = async (promoId: string, currentActiveState: boolean) => {
    try {
      await updateDoc(doc(db, 'promotions', promoId), {
        isActive: !currentActiveState
      });
      alert(currentActiveState ? 'Promoção desativada!' : 'Promoção ativada!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `promotions/${promoId}`);
    }
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar esta promoção? Isto não poderá ser desfeito.')) return;
    try {
      await deleteDoc(doc(db, 'promotions', promoId));
      alert('Promoção eliminada com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `promotions/${promoId}`);
    }
  };

  // --- Coupon Handlers ---
  const handleOpenCouponModal = (promoId: string) => {
    setCouponPromotionId(promoId);
    setCustomCouponCode('');
    setCouponUsageLimit('');
    setIsCouponModalOpen(true);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponPromotionId) return;

    let code = customCouponCode.trim().toUpperCase();
    if (!code) {
      // Auto-generate code
      code = 'SABUSH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Check code pattern (alphanumeric and some simple symbols)
    const codeRegex = /^[A-Z0-9_-]+$/;
    if (!codeRegex.test(code)) {
      alert('O código de cupom apenas pode conter letras maiúsculas, números e traços.');
      return;
    }

    const promotion = promotions.find(p => p.id === couponPromotionId);
    if (!promotion) {
      alert('Promoção não encontrada.');
      return;
    }

    try {
      const cleanLimit = couponUsageLimit ? parseInt(couponUsageLimit, 10) : null;
      const newCoupon: Coupon = {
        code,
        promotionId: couponPromotionId,
        discountPercentage: promotion.discountPercentage,
        expiryDate: promotion.endDate,
        isActive: true,
        usageLimit: cleanLimit,
        usageCount: 0
      };

      await setDoc(doc(db, 'coupons', code), newCoupon);
      setIsCouponModalOpen(false);
      setCustomCouponCode('');
      setCouponUsageLimit('');
      alert(`Cupom "${code}" criado com sucesso!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coupons/${code}`);
    }
  };

  const handleToggleCouponActive = async (code: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'coupons', code), {
        isActive: !currentActive
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coupons/${code}`);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este cupom?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', code));
      alert('Cupom de desconto eliminado!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${code}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleToggleProductVisibility = async (product: Product) => {
    try {
      const nextStatus = product.status === 'hidden' ? 'active' : 'hidden';
      await updateDoc(doc(db, 'products', product.id), {
        status: nextStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      purchasingPrice: String(product.purchasingPrice || ''),
      unitCxStock: String(product.unitCxStock || 0),
      unitEmbStock: String(product.unitEmbStock || 0),
      unitUnStock: String(product.unitUnStock || 0),
      category: product.category,
      imageUrl: product.images?.[0] || ''
    });
    setEditWholesaleTiers(
      product.wholesalePrices 
        ? product.wholesalePrices.map(t => ({ minQuantity: String(t.minQuantity), price: String(t.price) }))
        : []
    );
    setIsEditModalOpen(true);
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);

    const calculatedStock = (parseInt(editForm.unitCxStock) || 0) + (parseInt(editForm.unitEmbStock) || 0) + (parseInt(editForm.unitUnStock) || 0);
    const tiers = editWholesaleTiers
      .filter(t => t.minQuantity && t.price)
      .map(t => ({
        minQuantity: parseInt(t.minQuantity),
        price: parseFloat(t.price)
      }));

    const oldPrice = editingProduct.price;
    const newPrice = Number(editForm.price);
    const hasPriceDropped = newPrice < oldPrice;

    let updatedHistory = editingProduct.priceHistory || [];
    if (hasPriceDropped) {
      updatedHistory = [
        ...updatedHistory,
        {
          price: oldPrice,
          currency: editingProduct.currency || 'MZN',
          timestamp: new Date().toISOString()
        }
      ];
    }

    try {
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        stock: calculatedStock,
        purchasingPrice: parseFloat(editForm.purchasingPrice) || 0,
        unitCxStock: parseInt(editForm.unitCxStock) || 0,
        unitEmbStock: parseInt(editForm.unitEmbStock) || 0,
        unitUnStock: parseInt(editForm.unitUnStock) || 0,
        wholesalePrices: tiers.length > 0 ? tiers : null,
        category: editForm.category,
        images: [editForm.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'],
        priceHistory: updatedHistory
      });

      if (hasPriceDropped) {
        try {
          const alertsQuery = query(collectionGroup(db, 'priceAlerts'), where('productId', '==', editingProduct.id));
          const alertsSnap = await getDocs(alertsQuery);
          
          const percentSaved = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
          const currency = editingProduct.currency || 'MZN';
          
          alertsSnap.docs.forEach(async (alertDoc) => {
            const data = alertDoc.data();
            if (data.alertEnabled === true) {
              const alertUserId = alertDoc.ref.parent.parent?.id;
              if (alertUserId) {
                await sendNotification(
                  alertUserId,
                  `Queda de Preço: ${editingProduct.name}! 📈`,
                  `O preço do produto ${editingProduct.name} baixou de ${oldPrice} ${currency} para ${newPrice} ${currency}. Você poupa ${percentSaved}%!`,
                  'price_drop',
                  {
                    productId: editingProduct.id,
                    oldPrice,
                    newPrice,
                    percentSaved
                  }
                );
              }
            }
          });
        } catch (alertError) {
          console.error("Error sending price drop alerts:", alertError);
        }
      }

      setIsEditModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      alert(parseFirestoreError(error));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.businessName.trim() || !newStoreForm.category.trim() || !newStoreForm.password.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, Categoria, Palavra-passe).');
      return;
    }
    setCreatingStore(true);
    try {
      const hashedPassword = await hashPW(newStoreForm.password);
      
      const storeId = `store_${user?.uid}_${Date.now()}`;
      await setDoc(doc(db, 'stores', storeId), {
        ownerId: user?.uid,
        businessName: newStoreForm.businessName.trim(),
        category: newStoreForm.category.trim(),
        description: newStoreForm.description.trim(),
        logo: '', // empty to let them upload later in settings
        banner: '',
        location: `${newStoreForm.province}, ${newStoreForm.district}`,
        province: newStoreForm.province,
        district: newStoreForm.district,
        country: selectedCountry?.code || 'MZ',
        currency: selectedCountry?.currency || 'MZN',
        whatsappNumber: newStoreForm.whatsappNumber.trim() || profile?.phoneNumber || '',
        deliveryOptions: newStoreForm.deliveryOptions,
        rating: 0,
        reviewCount: 0,
        isVerified: false,
        status: 'pending', // matching firestore rules pending status for new creations
        hashedPassword,
        createdAt: new Date().toISOString()
      });
      
      setIsCreateStoreModalOpen(false);
      setNewStoreForm({
        businessName: '',
        category: '',
        offeringType: 'products',
        description: '',
        password: '',
        whatsappNumber: '',
        province: '',
        district: '',
        deliveryOptions: 'both'
      });
      alert('Loja criada com sucesso! Aguarda aprovação do administrador.');
    } catch (err) {
      alert(parseFirestoreError(err));
    } finally {
      setCreatingStore(false);
    }
  };

  const handleEnterStoreClick = (selectedStore: Store) => {
    setStoreToEnter(selectedStore);
    setPasswordInput('');
    setPasswordError('');
    setShowPasswordInModal(false);
    
    // Check if store has password, if not let them set one
    if (!selectedStore.hashedPassword) {
      setIsSettingPasswordForLegacy(true);
    } else {
      setIsSettingPasswordForLegacy(false);
    }
    setIsPasswordModalOpen(true);
  };

  const handleVerifyPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeToEnter) return;
    
    if (isSettingPasswordForLegacy) {
      if (!passwordInput || passwordInput.length < 4) {
        setPasswordError('A palavra-passe deve ter pelo menos 4 caracteres.');
        return;
      }
      try {
        const hashedPassword = await hashPW(passwordInput);
        await updateDoc(doc(db, 'stores', storeToEnter.id), {
          hashedPassword
        });
        setStore(storeToEnter);
        setIsPasswordModalOpen(false);
        setStoreToEnter(null);
      } catch (err) {
        setPasswordError(parseFirestoreError(err));
      }
      return;
    }
    
    try {
      const hashedInput = await hashPW(passwordInput);
      if (hashedInput === storeToEnter.hashedPassword) {
        // Authenticated! Enter shop!
        setStore(storeToEnter);
        setIsPasswordModalOpen(false);
        setStoreToEnter(null);
      } else {
        setPasswordError('Palavra-passe incorreta. Tente novamente.');
      }
    } catch (err) {
      setPasswordError('Ocorreu um erro ao verificar a senha.');
    }
  };

  const handleAnswerSubmit = async (qaId: string) => {
    const text = answersMap[qaId];
    if (!text || !text.trim()) return;
    try {
      await updateDoc(doc(db, 'qas', qaId), {
        answer: text.trim(),
        answeredAt: new Date().toISOString()
      });
      setAnswersMap(prev => ({ ...prev, [qaId]: '' }));
    } catch (e) {
      console.error("Error answering QA: ", e);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      alert(t('seller.no_products_to_export', 'Não há produtos para exportar / No products to export!'));
      return;
    }

    const headers = [
      'ID', 
      'Name', 
      'Name_PT', 
      'Description', 
      'Description_PT', 
      'Price', 
      'Stock', 
      'Category', 
      'Colors', 
      'Sizes', 
      'Image URL'
    ];

    const rows = products.map(prod => {
      const ptTranslation: { name?: string; description?: string } = prod.translations?.['pt'] || {};
      return [
        prod.id,
        prod.name || '',
        ptTranslation.name || '',
        prod.description || '',
        ptTranslation.description || '',
        prod.price || 0,
        prod.stock || 0,
        prod.category || '',
        prod.colors ? prod.colors.join(';') : '',
        prod.sizes ? prod.sizes.join(';') : '',
        prod.images ? prod.images[0] || '' : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const strVal = String(val);
          const escaped = strVal.replace(/"/g, '""');
          if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') || escaped.includes(';')) {
            return `"${escaped}"`;
          }
          return escaped;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${store?.businessName || 'store'}_products_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const analyticsData = React.useMemo(() => {
    // 1. Filter orders based on the selected date range
    const now = new Date();
    let cutoffDate: Date | null = null;
    
    if (analyticsRange === '7days') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 65 * 1000); // 7 days
    } else if (analyticsRange === '30days') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 65 * 1000); // 30 days
    } else if (analyticsRange === '90days') {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 65 * 1000); // 90 days
    }

    const filteredOrders = orders.filter(o => {
      if (!cutoffDate) return true;
      try {
        const orderDate = new Date(o.createdAt);
        return orderDate >= cutoffDate;
      } catch {
        return false;
      }
    });

    // 2. Compute totalProductViews (Views sum for all products belonging to this store)
    const totalProductViews = products.reduce((sum, p) => sum + (p.views || 0), 0);

    // 3. Compute revenue and revenueByCurrency
    let totalRevenue = 0;
    const revenueByCurrency = { MZN: 0, USD: 0, ZAR: 0 };

    const validRevenueOrders = filteredOrders.filter(o => o.status !== 'cancelled');

    validRevenueOrders.forEach(o => {
      const amount = o.totalAmount || 0;
      const cur = (o.currency || 'MZN').toUpperCase();
      if (cur === 'MZN') {
        revenueByCurrency.MZN += amount;
        totalRevenue += amount;
      } else if (cur === 'USD') {
        revenueByCurrency.USD += amount;
        totalRevenue += amount * 63.5;
      } else if (cur === 'ZAR') {
        revenueByCurrency.ZAR += amount;
        totalRevenue += amount * 3.5;
      }
    });

    // 4. Counts
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled').length;

    // 5. topViewedProducts (Top 5 viewed products)
    const topViewedProducts = [...products]
      .map(p => ({
        productId: p.id,
        name: getTranslatedField(p, 'name', p.name),
        views: p.views || 0
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // 6. topSellingProducts (Top 5 selling products by units sold)
    const unitsMap: { [prodId: string]: { name: string; unitsSold: number } } = {};
    products.forEach(p => {
      unitsMap[p.id] = { name: getTranslatedField(p, 'name', p.name), unitsSold: 0 };
    });

    validRevenueOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          if (unitsMap[item.productId]) {
            unitsMap[item.productId].unitsSold += item.quantity || 1;
          } else {
            unitsMap[item.productId] = { name: item.name || 'Unknown Item', unitsSold: item.quantity || 1 };
          }
        });
      }
    });

    const topSellingProducts = Object.entries(unitsMap)
      .map(([id, data]) => ({
        productId: id,
        name: data.name,
        unitsSold: data.unitsSold
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    // 7. revenueByProvince
    const PROVINCES = [
      'Maputo Cidade', 'Maputo', 'Gaza', 'Inhambane', 'Sofala', 
      'Manica', 'Tete', 'Zambezia', 'Zambézia', 'Nampula', 
      'Cabo Delgado', 'Niassa'
    ];

    const detectProvince = (address?: string): string => {
      if (!address) return 'Desconhecido';
      const lower = address.toLowerCase();
      for (const prov of PROVINCES) {
        if (lower.includes(prov.toLowerCase())) {
          if (prov.toLowerCase().includes('zambez')) return 'Zambézia';
          return prov;
        }
      }
      return 'Outra';
    };

    const provRevenueMap: { [province: string]: number } = {};
    validRevenueOrders.forEach(o => {
      const prov = detectProvince(o.deliveryAddress);
      const amount = o.totalAmount || 0;
      let mznAmount = amount;
      const cur = (o.currency || 'MZN').toUpperCase();
      if (cur === 'USD') mznAmount = amount * 63.5;
      else if (cur === 'ZAR') mznAmount = amount * 3.5;

      provRevenueMap[prov] = (provRevenueMap[prov] || 0) + mznAmount;
    });

    const revenueByProvince = Object.entries(provRevenueMap)
      .map(([province, revenue]) => ({
        province,
        revenue
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 8. Monthly comparisons (This month vs Last month)
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;

    validRevenueOrders.forEach(o => {
      try {
        const orderDate = new Date(o.createdAt);
        const amount = o.totalAmount || 0;
        let mznAmount = amount;
        const cur = (o.currency || 'MZN').toUpperCase();
        if (cur === 'USD') mznAmount = amount * 63.5;
        else if (cur === 'ZAR') mznAmount = amount * 3.5;

        if (orderDate >= firstDayThisMonth) {
          thisMonthRevenue += mznAmount;
        } else if (orderDate >= firstDayLastMonth && orderDate <= lastDayLastMonth) {
          lastMonthRevenue += mznAmount;
        }
      } catch {}
    });

    // 9. revenueByDay
    const getDaysArray = (numDays: number) => {
      const arr = [];
      for (let i = numDays - 1; i >= 0; i--) {
        const temp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const yyyy = temp.getFullYear();
        const mm = String(temp.getMonth() + 1).padStart(2, '0');
        const dd = String(temp.getDate()).padStart(2, '0');
        arr.push(`${yyyy}-${mm}-${dd}`);
      }
      return arr;
    };

    let days: string[] = [];
    if (analyticsRange === '7days') days = getDaysArray(7);
    else if (analyticsRange === '30days') days = getDaysArray(30);
    else if (analyticsRange === '90days') days = getDaysArray(90);
    else {
      // 'all' time
      if (filteredOrders.length > 0) {
        const dates = filteredOrders.map(o => o.createdAt.substring(0, 10));
        dates.sort();
        const earliestStr = dates[0];
        try {
          const earliest = new Date(earliestStr);
          const diffDays = Math.ceil(Math.abs(now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) || 1;
          days = getDaysArray(Math.min(90, Math.max(30, diffDays)));
        } catch {
          days = getDaysArray(30);
        }
      } else {
        days = getDaysArray(30);
      }
    }

    const dayRevenueMap: { [date: string]: number } = {};
    days.forEach(d => {
      dayRevenueMap[d] = 0;
    });

    validRevenueOrders.forEach(o => {
      try {
        const orderDateStr = o.createdAt.substring(0, 10);
        if (dayRevenueMap[orderDateStr] !== undefined) {
          const amount = o.totalAmount || 0;
          let mznAmount = amount;
          const cur = (o.currency || 'MZN').toUpperCase();
          if (cur === 'USD') mznAmount = amount * 63.5;
          else if (cur === 'ZAR') mznAmount = amount * 3.5;

          dayRevenueMap[orderDateStr] += mznAmount;
        }
      } catch {}
    });

    const revenueByDay = Object.entries(dayRevenueMap).map(([date, revenue]) => {
      const dObj = new Date(date + 'T00:00:00');
      const formattedDate = dObj.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' });
      return {
        date: formattedDate,
        revenue
      };
    });

    // 10. conversionRate
    const conversionRate = totalProductViews > 0 
      ? parseFloat(((totalOrders / totalProductViews) * 100).toFixed(2)) 
      : 0;

    return {
      totalRevenue,
      revenueByCurrency,
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalProductViews,
      topViewedProducts,
      topSellingProducts,
      revenueByProvince,
      revenueByDay,
      conversionRate,
      thisMonthRevenue,
      lastMonthRevenue
    };
  }, [orders, products, analyticsRange]);

  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const totalEarnings = analyticsData.totalRevenue;

  const stats = [
    { label: t('seller.total_earnings', 'Total Earnings'), value: `${formatCurrency(totalEarnings, store?.currency).split(',')[0]} ${store?.currency || 'MZN'}`, icon: TrendingUp, color: 'blue' },
    { label: t('seller.orders', 'Active Orders'), value: activeOrders.length.toString(), icon: ShoppingCart, color: 'orange' },
    { label: t('seller.products', 'Total Products'), value: products.length.toString(), icon: Package, color: 'green' },
    { label: t('seller.rating', 'Store Rating'), value: store?.rating.toString() || '0', icon: Star, color: 'purple' }
  ];

  // Legacy variables defined as compatibility fallbacks
  const periodDays = 14;
  const performanceDataset: any[] = [];
  const totalPeriodRevenue = 0;
  const totalPeriodVolume = 0;
  const totalPeriodOrders = 0;
  const salesData: any[] = [];
  const productPerformanceData: any[] = [];
  const conversionData: any[] = [];
  const total30Inquiries = 0;
  const total30Orders = 0;
  const avg30ConversionRate = "0.0";

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-14 w-48 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[1, 2, 3, 4].map(i => <StoreSkeleton key={i} />)}
        </div>
        <div className="bg-white rounded-[40px] h-96 border border-gray-100 animate-pulse" />
      </div>
    );
  }

  // Handle No Store Selected (My Shops Dashboard)
  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12 animate-fade-in">
          <div>
            <button 
              onClick={() => navigate('/marketplace')} 
              className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-all text-xs uppercase tracking-wider italic"
            >
               <ArrowLeft className="w-4 h-4" /> Ir para o Mercado / Back to Marketplace
            </button>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">Minhas Lojas / My Shops</h1>
            <p className="text-gray-500 mt-1.5 font-bold">Faça a gestão dos seus negócios ou registe um novo espaço comercial.</p>
          </div>
          
          <button 
            onClick={() => setIsCreateStoreModalOpen(true)}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-3xl transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 self-start sm:self-center"
          >
            <Plus className="w-5 h-5" /> Criar Nova Loja
          </button>
        </div>

        {myStores.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {myStores.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl overflow-hidden border border-blue-100/30">
                      {item.logo ? (
                        <img src={item.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        item.businessName[0].toUpperCase()
                      )}
                    </div>
                    {item.isVerified && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verificado
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{item.businessName}</h3>
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-wider mt-1.5 mb-3">
                    {item.category}
                  </span>
                  
                  <p className="text-gray-500 font-medium text-sm line-clamp-2 leading-relaxed min-h-[40px] mb-4">
                    {item.description || 'Nenhuma descrição fornecida.'}
                  </p>
                </div>

                <div className="border-t border-gray-50 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Estado</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                      item.status === 'active' ? "bg-green-50 text-green-600" :
                      item.status === 'pending' ? "bg-yellow-50 text-yellow-600" :
                      "bg-red-50 text-red-600"
                    )}>
                      {item.status === 'active' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />}
                      {item.status === 'active' ? 'Ativo' : item.status === 'pending' ? 'Pendente' : 'Suspenso'}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleEnterStoreClick(item)}
                    className="w-full py-4 bg-gray-50 hover:bg-blue-600 group-hover:bg-blue-600 hover:text-white group-hover:text-white text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-lg flex items-center justify-center gap-2 border border-gray-100 hover:border-transparent active:scale-95 cursor-pointer"
                  >
                    Entrar na Loja / Manage <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="max-w-xl mx-auto py-20 text-center animate-fade-in">
            <div className="bg-white p-8 sm:p-12 rounded-[40px] border border-gray-100 shadow-xl flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                <StoreIcon className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Ainda não criou nenhuma Loja</h2>
              <p className="text-gray-500 font-medium mb-8">Comece hoje a vender para milhares de clientes em Moçambique registando o seu primeiro negócio.</p>
              <button 
                onClick={() => setIsCreateStoreModalOpen(true)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                Registar o Meu Negócio <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== MODALS ==================== */}

        {/* 1. PASSWORD VERIFICATION MODAL */}
        <AnimatePresence>
          {isPasswordModalOpen && storeToEnter && (
            <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-[40px] border border-gray-100 shadow-2xl p-8 sm:p-10 max-w-md w-full relative overflow-hidden"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 animate-bounce" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight italic">
                    {isSettingPasswordForLegacy ? 'Definir Palavra-passe' : 'Acesso Seguro à Loja'}
                  </h2>
                  <p className="text-gray-500 font-medium text-sm mt-2 mb-6 leading-relaxed">
                    {isSettingPasswordForLegacy 
                      ? `Defina uma palavra-passe de acesso exclusivo para gerir a sua loja "${storeToEnter.businessName}".`
                      : `Insira a palavra-passe de acesso à loja "${storeToEnter.businessName}" para continuar.`}
                  </p>
                </div>

                <form onSubmit={handleVerifyPasswordSubmit} className="space-y-4">
                  {passwordError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /> {passwordError}
                    </div>
                  )}

                  <div className="relative">
                    <input 
                      type={showPasswordInModal ? 'text' : 'password'} 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={isSettingPasswordForLegacy ? 'Sua nova senha de acesso' : '••••••••'}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-2xl transition-all font-medium outline-none text-center text-lg tracking-widest placeholder:tracking-normal"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 transition-colors"
                    >
                      {showPasswordInModal ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsPasswordModalOpen(false);
                        setStoreToEnter(null);
                      }}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      {isSettingPasswordForLegacy ? 'Definir & Entrar' : 'Confirmar'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 2. CREATE NEW STORE MODAL */}
        <AnimatePresence>
          {isCreateStoreModalOpen && (
            <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-[40px] border border-gray-100 shadow-2xl p-6 sm:p-10 max-w-xl w-full relative my-8"
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <StoreIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight italic">Criar Novo Estabelecimento</h2>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Registar Nova Loja</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCreateStoreModalOpen(false)}
                    className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateStoreSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome Comercial *</label>
                      <input 
                        type="text" 
                        value={newStoreForm.businessName}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, businessName: e.target.value }))}
                        placeholder="Ex: Sabush Varejo"
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoria Principal *</label>
                      <select 
                        value={newStoreForm.category}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-bold text-sm"
                        required
                      >
                        <option value="">Selecione...</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Linha de Negócio</label>
                      <div className="grid grid-cols-3 p-1 bg-gray-50 border border-gray-100 rounded-2xl gap-1">
                        {(['products', 'services', 'both'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setNewStoreForm(prev => ({ ...prev, offeringType: type }))}
                            className={cn(
                              "py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                              newStoreForm.offeringType === type ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-900"
                            )}
                          >
                            {type === 'products' ? 'Produtos' : type === 'services' ? 'Serviços' : 'Ambos'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Opções de Entrega</label>
                      <div className="grid grid-cols-3 p-1 bg-gray-50 border border-gray-100 rounded-2xl gap-1">
                        {(['pickup', 'delivery', 'both'] as const).map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setNewStoreForm(prev => ({ ...prev, deliveryOptions: opt }))}
                            className={cn(
                              "py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                              newStoreForm.deliveryOptions === opt ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-900"
                            )}
                          >
                            {opt === 'pickup' ? 'Levant.' : opt === 'delivery' ? 'Entrega' : 'Ambos'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Localização: Província *</label>
                      <input 
                        type="text" 
                        value={newStoreForm.province}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, province: e.target.value }))}
                        placeholder="Ex: Maputo"
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Localização: Distrito / Cidade *</label>
                      <input 
                        type="text" 
                        value={newStoreForm.district}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, district: e.target.value }))}
                        placeholder="Ex: Matola"
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Telemóvel / WhatsApp (WhatsAppNumber)</label>
                      <input 
                        type="tel" 
                        value={newStoreForm.whatsappNumber}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        placeholder="Ex: +258 84 123 4567"
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Palavra-passe de Acesso à Loja *</label>
                      <input 
                        type="password" 
                        value={newStoreForm.password}
                        onChange={(e) => setNewStoreForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                        minLength={4}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descrição Comercial</label>
                    <textarea 
                      value={newStoreForm.description}
                      onChange={(e) => setNewStoreForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Fale brevemente do seu comércio, produtos principais e condições de entrega."
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium h-24 resize-none text-sm"
                    />
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-gray-50">
                    <button 
                      type="button"
                      onClick={() => setIsCreateStoreModalOpen(false)}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={creatingStore}
                      className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    >
                      {creatingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Estabelecimento'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Handle Pending Approval Status
  if (store.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-[40px] border border-gray-100 shadow-xl flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-yellow-50 text-yellow-600 rounded-[35px] flex items-center justify-center mb-8 border border-yellow-100 shadow-md">
            <Clock className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic mb-2">Loja em Análise!</h2>
          <h3 className="text-lg font-bold text-gray-500 tracking-tight mb-4">Shop Under Review</h3>
          <p className="text-gray-600 font-medium mb-2 leading-relaxed">
            A sua loja <span className="font-bold text-gray-900">"{store.businessName}"</span> está sob análise. Notificaremos em breve assim que o administrador aprovar o seu registo.
          </p>
          <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-8">
            Your shop is under review. We'll notify you soon.
          </p>
          <div className="w-full space-y-3">
            <button 
              type="button"
              onClick={() => setStore(null)} 
              className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-black text-sm uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-100 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para Minhas Lojas
            </button>
            <button 
              onClick={() => navigate('/marketplace')} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Ir para o Mercado / Marketplace
            </button>
            <button 
              onClick={async () => { await signOut(); navigate('/login'); }}
              className="w-full py-4 bg-gray-150 hover:bg-red-50 hover:text-red-650 text-gray-500 font-black text-sm uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
            >
              Sair da Conta / Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Handle Suspended Status
  if (store.status === 'suspended') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-[40px] border border-red-100 shadow-xl flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[35px] flex items-center justify-center mb-8 border border-red-100 shadow-md">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-red-600 tracking-tighter italic mb-2">Loja Suspensa</h2>
          <h3 className="text-lg font-bold text-gray-400 tracking-tight mb-4">Shop Suspended</h3>
          <p className="text-gray-600 font-medium mb-8 leading-relaxed">
            A sua conta de vendedor foi suspensa devido a violações dos termos. Por favor contacte o nosso suporte se achar que foi um erro.
          </p>
          <div className="w-full space-y-3">
            <button 
              type="button"
              onClick={() => setStore(null)} 
              className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-750 font-black text-sm uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-100 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para Minhas Lojas
            </button>
            <button 
              onClick={async () => { await signOut(); navigate('/login'); }}
              className="w-full py-4 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 font-black text-sm uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
            >
              Sair da Conta / Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button 
          onClick={() => setStore(null)} 
          className="flex items-center gap-2 text-gray-500 text-xs font-black uppercase tracking-wider hover:text-blue-650 transition-colors cursor-pointer"
        >
           <ArrowLeft className="w-5 h-5" /> Voltar para Minhas Lojas / Back to My Shops
        </button>
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-xl">
          Loja Ativa: <span className="text-blue-600">{store.businessName}</span>
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar */}
      <aside className="md:w-64 space-y-2">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 mb-6 shadow-sm">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4 mx-auto overflow-hidden">
             {store?.logo ? <img src={store.logo} alt="" className="w-full h-full object-cover" loading="lazy" /> : store?.businessName[0]}
           </div>
           <h3 className="font-bold text-gray-900 text-center line-clamp-1">{store?.businessName || 'My Store'}</h3>
           <div className="flex items-center justify-center gap-1.5 mt-1">
             {store?.isVerified ? (
               <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest flex items-center gap-1">
                 <CheckCircle className="w-3 h-3" /> Verified
               </p>
             ) : (
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Pending Verification</p>
             )}
           </div>
        </div>

        {[
          { id: 'overview', label: t('seller.overview'), icon: LayoutDashboard },
          { id: 'products', label: t('seller.products'), icon: Package },
          { id: 'orders', label: t('seller.orders'), icon: ShoppingCart },
          { id: 'rfqs', label: 'RFQs', icon: CheckCircle },
          { id: 'qas', label: 'Perguntas (Q&A)', icon: HelpCircle },
          { id: 'promotions', label: 'Promoções & Cupons', icon: Award },
          { id: 'finance', label: 'Minhas Finanças', icon: Wallet },
          { id: 'settings', label: t('seller.settings'), icon: Settings }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
              activeTab === item.id ? "bg-blue-600 text-white shadow-xl shadow-blue-100" : "text-gray-400 hover:bg-white hover:text-blue-600"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}

        <button
          onClick={async () => { await signOut(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-gray-400 hover:bg-red-50 hover:text-red-600 mt-8"
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">{t('seller.overview', 'Store Overview')}</h1>
                  <p className="text-gray-400 font-medium text-sm mt-1">{t('seller.overview_desc', 'Performance and quick actions.')}</p>
                </div>
                <div className="hidden sm:block text-right">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last updated</p>
                   <p className="text-xs font-bold text-gray-900">{new Date().toLocaleTimeString()}</p>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-6 sm:p-8 rounded-[40px] border border-blue-100/30 shadow-xs">
                <h3 className="text-lg font-black text-blue-900 italic mb-1">
                  Atalhos de Gestão / Quick Integration Actions
                </h3>
                <p className="text-xs text-blue-700 font-bold uppercase tracking-wider mb-6">Comece a vender adicionando artigos ou configurando as informações do seu negócio.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button 
                    onClick={() => { setActiveTab('products'); setIsAddModalOpen(true); }}
                    className="flex flex-col items-start p-5 bg-white hover:bg-blue-600 hover:text-white text-gray-850 rounded-3xl border border-gray-100 transition-all shadow-xs group cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/10 group-hover:text-white transition-colors">
                      <Package className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm tracking-tight mb-1">Adicionar Produto / Add Product</span>
                    <span className="text-[10px] text-gray-400 group-hover:text-blue-100 font-bold">Registe artigos físicos para venda imediata.</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('products'); setIsAddModalOpen(true); }}
                    className="flex flex-col items-start p-5 bg-white hover:bg-blue-600 hover:text-white text-gray-850 rounded-3xl border border-gray-100 transition-all shadow-xs group cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/10 group-hover:text-white transition-colors">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm tracking-tight mb-1">Descrever Serviço / Add Service</span>
                    <span className="text-[10px] text-gray-400 group-hover:text-indigo-100 font-bold">Instale assistência técnica ou consultoria de serviços.</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('settings')}
                    className="flex flex-col items-start p-5 bg-white hover:bg-blue-600 hover:text-white text-gray-850 rounded-3xl border border-gray-100 transition-all shadow-xs group cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/10 group-hover:text-white transition-colors">
                      <Settings className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm tracking-tight mb-1">Configurar Loja / Settings</span>
                    <span className="text-[10px] text-gray-400 group-hover:text-purple-100 font-bold">Altere a sua descrição comercial, logotipo e contactos.</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                       stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                       stat.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                       stat.color === 'green' ? 'bg-green-50 text-green-600' :
                       'bg-purple-50 text-purple-600'
                     }`}>
                        <stat.icon className="w-6 h-6" />
                     </div>
                     <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                     <p className="text-xl font-black text-gray-900 tracking-tight">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Seller Trust Signals Card */}
              {store && (
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-gray-50">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 italic flex items-center gap-2">
                        <Award className="w-6 h-6 text-blue-600 shrink-0" />
                        Reputação & Sinais de Confiança // Shop Trust & Standing
                      </h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Como os compradores avaliam a sua conta antes de comprar</p>
                    </div>
                    {store.isVerifiedBusiness ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-105 rounded-2xl text-blue-700 self-start md:self-auto">
                        <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="leading-none text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest">Empresa Verificada</p>
                          <p className="text-[8px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">Verified Business Badge Active</p>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-gray-400 self-start md:self-auto">
                        <Clock className="w-5 h-5 shrink-0" />
                        <div className="leading-none text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest font-sans">Não Verificada</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Contact support to verify</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Response Rate */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-400 uppercase tracking-wider">Taxa de Resposta // Response Rate</span>
                        <span className={cn(
                          "font-black text-sm",
                          (liveTrust?.responseRate ?? 100) > 80 ? "text-emerald-600" : (liveTrust?.responseRate ?? 100) >= 50 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {liveTrust?.responseRate ?? 100}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            (liveTrust?.responseRate ?? 100) > 80 ? "bg-emerald-500" : (liveTrust?.responseRate ?? 100) >= 50 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${liveTrust?.responseRate ?? 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {(liveTrust?.responseRate ?? 100) > 80 ? "Excelente taxa de interação diária" : "Responda mais rápido aos novos chats"}
                      </p>
                    </div>

                    {/* Fulfillment Rate */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-400 uppercase tracking-wider">Sucesso de Envios // Fulfillment</span>
                        <span className={cn(
                          "font-black text-sm",
                          (liveTrust?.fulfillmentRate ?? 100) > 80 ? "text-emerald-600" : (liveTrust?.fulfillmentRate ?? 100) >= 50 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {liveTrust?.fulfillmentRate ?? 100}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            (liveTrust?.fulfillmentRate ?? 100) > 80 ? "bg-emerald-500" : (liveTrust?.fulfillmentRate ?? 100) >= 50 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${liveTrust?.fulfillmentRate ?? 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {(liveTrust?.fulfillmentRate ?? 100) > 80 ? "Encomendas enviadas com sucesso" : "Evite cancelar encomendas aceites"}
                      </p>
                    </div>

                    {/* Average Response Time */}
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm text-gray-500">
                        <Clock className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tempo de Resposta</p>
                        <h4 className="text-xs font-black text-gray-800 mt-0.5 line-clamp-1">{liveTrust?.averageResponseTime || "Usually in a few hours"}</h4>
                      </div>
                    </div>

                    {/* Total Sales */}
                    <div className="p-4 bg-gray-50 border border-gray-100 text-left rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm text-gray-500">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total de Vendas</p>
                        <h4 className="text-sm font-black text-gray-900 mt-0.5">{liveTrust?.totalSales || 0}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Range Filter / Seletor de Período */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs mb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 italic">Filtros de Análise / Analysis Filter</h3>
                  <p className="text-xs text-gray-400 font-bold">Defina o intervalo de tempo para atualizar todas as métricas em tempo real.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner self-start sm:self-auto">
                  {(['7days', '30days', '90days', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setAnalyticsRange(range)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer",
                        analyticsRange === range
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400 hover:text-gray-900"
                      )}
                    >
                      {range === '7days' ? '7 Dias' : range === '30days' ? '30 Dias' : range === '90days' ? '90 Dias' : 'Tudo'}
                    </button>
                  ))}
                </div>
              </div>

              {isAnalyticsLoading ? (
                // Beautiful loading skeletons matching Recharts card formats
                <div className="space-y-8 animate-pulse">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                        <div className="h-4 w-24 bg-gray-100 rounded" />
                        <div className="h-8 w-44 bg-gray-200 rounded" />
                        <div className="h-3 w-32 bg-gray-100 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm h-80 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="h-5 w-48 bg-gray-200 rounded" />
                        <div className="h-3 w-64 bg-gray-100 rounded" />
                      </div>
                      <div className="h-44 w-full bg-gray-50 rounded-2xl" />
                    </div>
                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm h-80 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="h-5 w-48 bg-gray-200 rounded" />
                        <div className="h-3 w-64 bg-gray-100 rounded" />
                      </div>
                      <div className="h-44 w-full bg-gray-50 rounded-2xl" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Revenue summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Revenue Card */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Rendimento Bruto total</p>
                      <h4 className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(analyticsData.totalRevenue, 'MZN')}</h4>
                      <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-3 gap-2 text-center text-[10px] font-sans">
                        <div>
                          <p className="text-gray-400 font-extrabold uppercase">MZN</p>
                          <p className="font-black text-gray-805">{formatCurrency(analyticsData.revenueByCurrency.MZN, 'MZN').split(',')[0]}</p>
                        </div>
                        <div className="border-x border-gray-100 font-sans">
                          <p className="text-gray-400 font-extrabold uppercase font-sans">USD</p>
                          <p className="font-black text-gray-805">${analyticsData.revenueByCurrency.USD}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-extrabold uppercase font-sans">ZAR</p>
                          <p className="font-black text-gray-805">R {analyticsData.revenueByCurrency.ZAR}</p>
                        </div>
                      </div>
                    </div>

                    {/* This Month's Revenue Card */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Faturação Recente (Este Mês)</p>
                      <h4 className="text-3xl font-black text-blue-650 tracking-tight">{formatCurrency(analyticsData.thisMonthRevenue, 'MZN')}</h4>
                      <p className="mt-2 text-[10px] text-gray-500 font-bold">
                        Faturação acumulada de {new Date().toLocaleDateString('pt-PT', { month: 'long' })}.
                      </p>
                    </div>

                    {/* Comparison vs Last Month */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Mês Anterior vs Atual</p>
                      <h4 className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(analyticsData.lastMonthRevenue, 'MZN')}</h4>
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold">
                        {analyticsData.thisMonthRevenue >= analyticsData.lastMonthRevenue ? (
                          <span className="text-emerald-600 font-black flex items-center gap-0.5">
                            ▲ +{analyticsData.lastMonthRevenue > 0 ? ((analyticsData.thisMonthRevenue / analyticsData.lastMonthRevenue) * 100).toFixed(0) : '100'}%
                          </span>
                        ) : (
                          <span className="text-rose-600 font-black flex items-center gap-0.5">
                            ▼ -{analyticsData.thisMonthRevenue > 0 ? (100 - (analyticsData.thisMonthRevenue / analyticsData.lastMonthRevenue) * 100).toFixed(0) : '100'}%
                          </span>
                        )}
                        <span className="text-gray-400 font-bold">de variação em termos de volume</span>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Over Time Line Chart */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 italic">Rendimento Diário / Revenue Performance</h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">Resultados diários expressos em equivalentes de meticais (MZN).</p>
                    </div>
                    <div className="h-64 w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.revenueByDay} margin={{ left: -10, right: 5, top: 10 }}>
                          <defs>
                            <linearGradient id="colorRevenueDay" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            dy={6}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#10b981' }}
                            tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                          />
                          <Tooltip 
                            isAnimationActive={false}
                            wrapperStyle={{ pointerEvents: 'none', outline: 'none' }}
                            contentStyle={{ borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05)', padding: '16px', pointerEvents: 'none' }}
                            itemStyle={{ fontWeight: 800, color: '#1e293b', fontSize: '11px' }}
                            labelStyle={{ color: '#94a3b8', fontWeight: 700, fontSize: '9px', marginBottom: '4px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            name="Receita"
                            stroke="#10b981" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorRevenueDay)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

                {/* Top Selling Products Bar Chart & Conversion Indicators */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Selling Products Bar Chart */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 italic">Produtos Mais Vendidos / Top Selling Products</h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">Rendimento classificado em termos de unidades físicas despachadas.</p>
                    </div>
                    <div className="h-64 w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.topSellingProducts} layout="vertical" margin={{ left: -10, right: 10, top: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis 
                            type="number"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category"
                            axisLine={false} 
                            tickLine={false} 
                            width={90}
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#1e293b' }}
                            tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            isAnimationActive={false}
                            wrapperStyle={{ pointerEvents: 'none', outline: 'none' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', pointerEvents: 'none' }}
                            itemStyle={{ fontWeight: 800, color: '#1e293b', fontSize: '11px' }}
                          />
                          <Bar 
                            dataKey="unitsSold" 
                            name="Unidades Vendidas"
                            fill="#3b82f6" 
                            radius={[0, 8, 8, 0]}
                            barSize={18}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Viewed Products Chart */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 italic">Produtos Mais Visualizados / Top Viewed Products</h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">Total de cliques únicos registados por produto ("Favoritos" em perspetiva).</p>
                    </div>
                    <div className="h-64 w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.topViewedProducts} layout="vertical" margin={{ left: -10, right: 10, top: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis 
                            type="number"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category"
                            axisLine={false} 
                            tickLine={false} 
                            width={90}
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#1e293b' }}
                            tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            isAnimationActive={false}
                            wrapperStyle={{ pointerEvents: 'none', outline: 'none' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', pointerEvents: 'none' }}
                            itemStyle={{ fontWeight: 800, color: '#1e293b', fontSize: '11px' }}
                          />
                          <Bar 
                            dataKey="views" 
                            name="Visualizações"
                            fill="#10b981" 
                            radius={[0, 8, 8, 0]}
                            barSize={18}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Province Heatmap & Conversion Rate Gauge */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Province Heatmap progress list */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm space-y-6">
                    <div>
                      <h4 className="text-lg font-black text-gray-900 italic">Vendas por Província / Revenue by Province</h4>
                      <p className="text-xs text-gray-400 font-bold">Dispersão regional do faturamento do comerciante no país.</p>
                    </div>

                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                      {analyticsData.revenueByProvince.length > 0 ? (
                        analyticsData.revenueByProvince.map((p, idx) => {
                          const maxRev = Math.max(...analyticsData.revenueByProvince.map(item => item.revenue)) || 1;
                          const pct = Math.round((p.revenue / maxRev) * 100);
                          return (
                            <div key={idx} className="space-y-1 text-left">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-gray-800">{p.province}</span>
                                <span className="font-black text-blue-650">{formatCurrency(p.revenue, 'MZN')}</span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-50 border border-gray-100/50 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 text-xs font-bold text-gray-400">
                          Nenhuma encomenda com dados de endereço de entrega registada.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversion Rate Ring Indicator and details */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-8 justify-around">
                    <div className="space-y-3 shrink-0 text-center sm:text-left">
                      <h4 className="text-lg font-black text-gray-900 italic">Conversão de Clientes</h4>
                      <p className="text-[11px] text-gray-400 font-bold max-w-xs leading-relaxed font-sans">
                        Percentagem total de visualizações de anúncios transformadas em ordens de compra efetuadas no sistema.
                      </p>
                      <div className="pt-2 text-xs font-extrabold text-gray-750 space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-50 text-left">
                        <p className="flex justify-between gap-6 font-sans">👀 Cliques em Anúncios: <span className="font-black text-gray-900">{analyticsData.totalProductViews}</span></p>
                        <p className="flex justify-between gap-6 font-sans">📦 Encomendas Criadas: <span className="font-black text-gray-900">{analyticsData.totalOrders}</span></p>
                      </div>
                    </div>

                    <div className="relative w-36 h-36 flex items-center justify-center">
                      {/* Custom Circular SVG Progress Gauge */}
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="50"
                          stroke="#f1f5f9"
                          strokeWidth="10"
                          fill="transparent"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="50"
                          stroke="#2563eb"
                          strokeWidth="10"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 50}
                          strokeDashoffset={2 * Math.PI * 50 - (Math.min(100, analyticsData.conversionRate) / 100) * (2 * Math.PI * 50)}
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <p className="text-2xl font-black text-blue-650">{analyticsData.conversionRate}%</p>
                        <p className="text-[8px] text-gray-400 font-black uppercase tracking-wider">Altas Conversões</p>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-gray-900 text-xl italic">Recent Orders</h3>
                      <button onClick={() => setActiveTab('orders')} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-all flex items-center gap-1">
                        View All <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {orders.length > 0 ? orders.slice(0, 3).map((order) => (
                         <div key={order.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 border border-gray-100">
                                {order.isGuest || !order.customerId 
                                  ? (order.guestName ? order.guestName.slice(0, 2).toUpperCase() : 'GS') 
                                  : order.customerId.slice(-2).toUpperCase()
                                }
                              </div>
                              <div>
                                 <p className="font-black text-gray-900">#ORD-{order.id.slice(-6).toUpperCase()}</p>
                                 <p className="text-xs font-bold text-gray-600">
                                   {order.isGuest ? `${order.guestName} (Guest)` : (order.customerName || 'Cliente')}
                                 </p>
                                 <p className="text-[10px] text-gray-400 font-bold">{new Date(order.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2 shrink-0">
                               <p className="font-black text-gray-900">{formatCurrency(order.totalAmount, store?.currency)}</p>
                               <OrderProgressSteps status={order.status} className="w-44 sm:w-48" />
                            </div>
                         </div>
                      )) : (
                        <div className="py-12 text-center text-gray-300">
                          <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p className="font-bold text-sm">No orders yet</p>
                        </div>
                      )}
                    </div>
                 </div>

                 <div className="bg-gray-900 p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp className="w-24 h-24 stroke-[4]" /></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Insights</p>
                      </div>
                      <h3 className="text-3xl font-black mb-4 italic tracking-tight italic">Global Reach</h3>
                      <p className="text-gray-400 mb-8 font-medium">Your store is now visible to customers across Mozambique. Keep your stock updated to stay relevant.</p>
                      
                      <div className="flex items-end gap-2 h-24 mb-6">
                         {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                           <div key={i} className="flex-1 bg-blue-600 rounded-t-lg transition-all hover:bg-blue-400 cursor-pointer shadow-lg shadow-blue-900/50" style={{ height: `${h}%` }}></div>
                         ))}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">
                         <span>MON</span>
                         <span className="text-blue-500">TODAY</span>
                         <span>SUN</span>
                      </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div 
              key="products"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">Product Catalog</h1>
                    <p className="text-gray-400 font-medium text-sm mt-1">Manage your storefront listings.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button 
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-6 py-4 bg-white border border-gray-200 text-gray-700 rounded-[24px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:border-gray-300 transition-all italic cursor-pointer animate-fade-in"
                      type="button"
                    >
                       <FileSpreadsheet className="w-5 h-5 text-green-600" /> Import CSV
                    </button>
                    <button 
                      onClick={handleExportCSV}
                      className="px-6 py-4 bg-white border border-gray-200 text-gray-700 rounded-[24px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:border-gray-300 transition-all italic cursor-pointer animate-fade-in"
                      type="button"
                    >
                       <Download className="w-5 h-5 text-blue-600" /> Export CSV
                    </button>
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all italic cursor-pointer"
                      type="button"
                    >
                       <Plus className="w-5 h-5" /> New Product
                    </button>
                  </div>
               </div>

               <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-gray-50/50">
                          <tr>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {products.length > 0 ? products.map(prod => (
                             <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-4">
                                      <div className="w-14 h-14 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex-shrink-0">
                                        <img src={prod.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-black text-gray-900 block truncate">{getTranslatedField(prod, 'name', prod.name)}</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                            {CATEGORIES.find(c => c.id === prod.category)?.translationKey ? t(CATEGORIES.find(c => c.id === prod.category)!.translationKey!) : prod.category}
                                          </span>
                                          {prod.colors && prod.colors.length > 0 && (
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 border border-indigo-100">
                                              <span>Colors:</span> <span className="opacity-80">{prod.colors.slice(0, 3).join(', ')}{prod.colors.length > 3 ? '...' : ''}</span>
                                            </span>
                                          )}
                                          {prod.sizes && prod.sizes.length > 0 && (
                                            <span className="px-2 py-0.5 bg-amber-55 text-amber-700 bg-amber-50 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 border border-amber-100">
                                              <span>Sizes:</span> <span className="opacity-80">{prod.sizes.slice(0, 3).join(', ')}{prod.sizes.length > 3 ? '...' : ''}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                  <p className="font-black text-gray-900">{formatCurrency(prod.price, store?.currency)}</p>
                                  {prod.purchasingPrice !== undefined && prod.purchasingPrice > 0 && (
                                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">Custo: {formatCurrency(prod.purchasingPrice, store?.currency)}</p>
                                  )}
                                </td>
                                <td className="px-8 py-6">
                                   <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest", prod.stock < 5 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                                      {prod.unitCxStock !== undefined || prod.unitEmbStock !== undefined || prod.unitUnStock !== undefined ? (
                                        <span className="flex flex-col gap-0.5 select-none font-bold">
                                          {[
                                            prod.unitCxStock ? `${prod.unitCxStock} Cx` : null,
                                            prod.unitEmbStock ? `${prod.unitEmbStock} Emb` : null,
                                            (prod.unitUnStock || (!prod.unitCxStock && !prod.unitEmbStock)) ? `${prod.unitUnStock || 0} Un` : null
                                          ].filter(Boolean).map((u, i) => (
                                            <span key={i} className="text-[10px] whitespace-nowrap">{u}</span>
                                          ))}
                                        </span>
                                      ) : (
                                        <span>{prod.stock} in stock</span>
                                      )}
                                   </span>
                                </td>
                                <td className="px-8 py-6 text-right space-x-2 whitespace-nowrap">
                                    <button 
                                       onClick={() => {
                                          setSelectedProductForVariants(prod);
                                          setIsVariantsModalOpen(true);
                                       }}
                                       className="p-3 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm"
                                       title={t('seller.manage_variants', 'Manage Variants')}
                                    >
                                       <Sliders className="w-5 h-5" />
                                    </button>
                                   <button 
                                      onClick={() => handleToggleProductVisibility(prod)}
                                      className={cn(
                                        "p-3 rounded-xl transition-all shadow-sm",
                                        prod.status === 'hidden' 
                                          ? "bg-amber-100 text-amber-600" 
                                          : "bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                      )}
                                      title={prod.status === 'hidden' ? "Mostrar no Mercado" : "Ocultar do Mercado"}
                                    >
                                      {prod.status === 'hidden' ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                    <button 
                                      onClick={() => handleEditProductClick(prod)}
                                      className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                                      title="Editar Produto"
                                    >
                                      <Edit className="w-5 h-5" />
                                    </button>
                                   <button onClick={() => handleDeleteProduct(prod.id)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                                </td>
                             </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="py-20 text-center">
                                <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                                <p className="font-black text-gray-300 italic uppercase tracking-widest">Your catalog is empty</p>
                              </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">Order Management</h1>
              <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-gray-50/50">
                          <tr>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Controlo de Rastreio / Tracking</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {orders.length > 0 ? orders.map(order => (
                             <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                 <td className="px-8 py-6">
                                    <div className="flex items-center gap-2">
                                      <p className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">#{order.id.slice(-8).toUpperCase()}</p>
                                      {order.paymentSimulated && (
                                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200/50">
                                          SIMULATED
                                        </span>
                                      )}
                                    </div>
                                 </td>
                                <td className="px-8 py-6">
                                   <p className="font-bold text-gray-900">{order.isGuest 
                                      ? `${order.guestName || 'Cliente Convidado'} (Guest)` 
                                      : `${order.customerName || 'Cliente Registado'} (#${(order.customerId || '').slice(-4)})`}
                                  </p>
                                  <div className="flex flex-col text-[10px] text-gray-500 mt-1.5 space-y-1 font-normal tracking-normal normal-case">
                                    {(order.isGuest ? order.guestPhone : order.customerPhone) && (
                                      <p>Tel: <span className="font-bold text-gray-700">{order.isGuest ? order.guestPhone : order.customerPhone}</span></p>
                                    )}
                                    {(order.isGuest ? order.guestWhatsapp : order.customerPhone) && (
                                      <div className="flex items-center gap-1">
                                        <span>WhatsApp:</span>
                                        <a 
                                          href={`https://wa.me/${((order.isGuest ? order.guestWhatsapp : order.customerPhone) || '').replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-black text-green-605 text-green-600 hover:underline p-0.5 bg-green-50 rounded border border-green-100 flex items-center gap-0.5"
                                        >
                                          {order.isGuest ? order.guestWhatsapp : order.customerPhone} →
                                        </a>
                                      </div>
                                    )}
                                    {(order.isGuest ? order.guestEmail : order.customerEmail) && (
                                      <p className="truncate max-w-[150px]">Email: {order.isGuest ? order.guestEmail : order.customerEmail}</p>
                                    )}
                                    {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
                                      <p className="italic text-gray-400 max-w-[150px] truncate" title={order.deliveryAddress}>
                                        Endereço: {order.deliveryAddress}
                                      </p>
                                    )}
                                    <p className="text-[9px] font-black uppercase text-blue-500 tracking-wider">
                                      Modo: {order.deliveryMethod === 'pickup' ? 'Levantamento' : 'Entrega'}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                   <p className="text-xs font-bold text-gray-500">{order.items.length} unique items</p>
                                </td>
                                <td className="px-8 py-6">
                                   <p className="font-black text-gray-900">{formatCurrency(order.totalAmount, store?.currency)}</p>
                                </td>
                                <td className="px-8 py-5 min-w-[280px]">
                                   <div className="flex flex-col gap-3">
                                      <select 
                                        value={order.status}
                                        onChange={async (e) => {
                                           const newStatus = e.target.value;
                                           try {
                                             await updateDoc(doc(db, 'orders', order.id), { status: newStatus });
                                             if (newStatus === 'confirmed') {
                                               await handleOrderPayout(order.id);
                                             }
                                           } catch (err) {
                                             alert(parseFirestoreError(err));
                                           }
                                        }}
                                        className={cn(
                                          "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-none outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all w-fit",
                                          order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                                          order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                          'bg-blue-100 text-blue-600'
                                        )}
                                      >
                                         <option value="pending">Pending</option>
                                         <option value="confirmed">Confirmed</option>
                                         <option value="processing">Processing</option>
                                         <option value="shipped">Shipped</option>
                                         <option value="delivered">Delivered</option>
                                         <option value="cancelled">Cancelled</option>
                                      </select>
                                      <OrderProgressSteps status={order.status} className="w-full" />
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   {(() => {
                                      const trackingStages = [
                                        'Order Placed',
                                        'Confirmed by Seller',
                                        'Preparing',
                                        'Shipped',
                                        'Out for Delivery',
                                        'Delivered'
                                      ];
                                      const currentTrackingStatus = order.trackingStatus || 'Order Placed';
                                      const currentIndex = trackingStages.indexOf(currentTrackingStatus);
                                      const isLastStage = currentIndex === trackingStages.length - 1;
                                      const nextStage = isLastStage ? null : trackingStages[currentIndex + 1];

                                      const getStageLabelPT = (stage: string) => {
                                        switch (stage) {
                                          case 'Order Placed': return 'Pedido Recebido';
                                          case 'Confirmed by Seller': return 'Confirmado pelo Vendedor';
                                          case 'Preparing': return 'Em Preparação';
                                          case 'Shipped': return 'Enviado';
                                          case 'Out for Delivery': return 'Saiu para Entrega';
                                          case 'Delivered': return 'Entregue';
                                          default: return stage;
                                        }
                                      };

                                      const handleAdvanceTracking = async () => {
                                        if (isLastStage || !nextStage) return;
                                        
                                        const newHistory = [
                                          ...(order.trackingHistory || [{ stage: 'Order Placed', timestamp: order.createdAt }])
                                        ];
                                        
                                        if (!newHistory.some(e => e.stage === nextStage)) {
                                          newHistory.push({ stage: nextStage, timestamp: new Date().toISOString() });
                                        }
                                        
                                        try {
                                          let newGeneralStatus = order.status;
                                          if (nextStage === 'Confirmed by Seller') newGeneralStatus = 'confirmed';
                                          if (nextStage === 'Preparing') newGeneralStatus = 'processing';
                                          if (nextStage === 'Shipped') newGeneralStatus = 'shipped';
                                          if (nextStage === 'Delivered') newGeneralStatus = 'delivered';
                                          
                                          await updateDoc(doc(db, 'orders', order.id), {
                                            trackingStatus: nextStage,
                                            trackingHistory: newHistory,
                                            status: newGeneralStatus
                                          });
                                          if (newGeneralStatus === 'confirmed') {
                                            await handleOrderPayout(order.id);
                                          }
                                        } catch (err) {
                                          alert(parseFirestoreError(err));
                                        }
                                      };

                                      return (
                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                          <div className="flex items-center gap-2">
                                            <span className="w-20px h-2 bg-blue-500 rounded-full animate-pulse shrink-0" style={{ width: '8px', height: '8px' }} />
                                            <p className="text-xs font-bold text-gray-900 tracking-tight">
                                              {getStageLabelPT(currentTrackingStatus)}
                                            </p>
                                          </div>
                                          
                                          {!isLastStage ? (
                                            <button
                                              onClick={handleAdvanceTracking}
                                              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 border border-blue-100"
                                            >
                                              Avançar para: {getStageLabelPT(nextStage!)} &rarr;
                                            </button>
                                          ) : (
                                            <div className="px-3.5 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center border border-green-100 flex items-center justify-center gap-1">
                                              ✓ Entregue / Finished
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                </td>
                             </tr>
                          )) : (
                            <tr>
                              <td colSpan={6} className="py-20 text-center">
                                <ShoppingCart className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                                <p className="font-black text-gray-300 italic uppercase tracking-widest">No orders recorded</p>
                              </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                  </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rfqs' && (
            <motion.div 
              key="rfqs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">{t('b2b.quotation_requests')}</h1>
               <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-gray-50/50">
                          <tr>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Inquiry Date</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                             <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {rfqs.length > 0 ? rfqs.map(rfq => (
                             <tr key={rfq.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-6">
                                   <p className="text-xs font-bold text-gray-500">{new Date(rfq.createdAt).toLocaleDateString()}</p>
                                </td>
                                <td className="px-8 py-6">
                                   <p className="font-bold text-gray-900 uppercase tracking-tighter italic">{rfq.productName}</p>
                                </td>
                                <td className="px-8 py-6">
                                   <p className="font-black text-gray-900">{rfq.quantity} units</p>
                                </td>
                                <td className="px-8 py-6">
                                   <span className={cn(
                                     "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none",
                                     rfq.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                                   )}>
                                      {rfq.status}
                                   </span>
                                </td>
                                <td className="px-8 py-6 text-right space-x-2">
                                   <button 
                                     onClick={async () => {
                                        try {
                                          await updateDoc(doc(db, 'rfqs', rfq.id), { status: 'responded' });
                                        } catch (err) {
                                          console.error(err);
                                        }
                                     }}
                                     className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ml-auto"
                                   >
                                      {t('b2b.respond')}
                                   </button>
                                </td>
                             </tr>
                          )) : (
                            <tr>
                              <td colSpan={5} className="py-20 text-center">
                                <Clock className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                                <p className="font-black text-gray-300 italic uppercase tracking-widest">No quote requests yet</p>
                              </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'qas' && (
            <motion.div 
              key="qas"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 sm:p-10 rounded-[40px] border border-gray-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-50">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight italic flex items-center gap-3">
                      <HelpCircle className="w-7 h-7 text-blue-600" />
                      Perguntas dos Clientes / Customer Inquiries (Q&A)
                    </h2>
                    <p className="text-xs text-gray-400 font-bold mt-1">
                      Aumente a conversão de vendas respondendo rapidamente às perguntas dos compradores.
                    </p>
                  </div>
                  <div className="text-xs font-black bg-blue-50 text-blue-600 px-4 py-2 rounded-full uppercase tracking-wider self-start sm:self-auto">
                    {qas.length} {qas.length === 1 ? 'Pergunta Total' : 'Perguntas Totais'}
                  </div>
                </div>

                <div className="space-y-6">
                  {qas.map((qa) => {
                    const prod = products.find(p => p.id === qa.productId);
                    return (
                      <div key={qa.id} className="p-6 sm:p-8 rounded-[32px] border border-gray-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-all">
                        {/* Product Meta */}
                        <div className="w-full md:w-64 shrink-0 space-y-3">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Artigo Inspecionado</p>
                          {prod ? (
                            <div className="flex gap-3">
                              <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden shrink-0">
                                <img src={prod.images?.[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black text-gray-900 leading-snug line-clamp-2 italic">{prod.name}</h4>
                                <p className="text-[10px] text-blue-600 font-bold mt-0.5">{formatCurrency(prod.price, prod.currency || 'MZN')}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 font-bold italic">Artigo removido ou indisponível</p>
                          )}
                        </div>

                        {/* Question and Answer block */}
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-gray-800">{qa.userName}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{qa.createdAt ? new Date(qa.createdAt).toLocaleDateString() : 'Aguardando'}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/60 text-sm font-semibold text-slate-700">
                              {qa.question}
                            </div>
                          </div>

                          {/* Answers interaction workflow */}
                          {qa.answer ? (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1">Sua Resposta Publicada</p>
                              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-150/40 text-xs font-semibold text-emerald-800 italic leading-relaxed">
                                {qa.answer}
                                <button
                                  onClick={() => {
                                    setAnswersMap(prev => ({ ...prev, [qa.id]: qa.answer }));
                                    // Set qa.answer to null in state temporarily so input shows again
                                    setQas(prev => prev.map(item => item.id === qa.id ? { ...item, answer: undefined } : item));
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-black uppercase tracking-wider ml-3 leading-none italic block mt-2 hover:underline cursor-pointer"
                                >
                                  Editar Resposta
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest ml-1">Responder ao Comprador</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 px-4 py-3 bg-white border border-gray-150 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
                                  placeholder="Digite a resposta curta e clara para o produto..."
                                  value={answersMap[qa.id] || ''}
                                  onChange={(e) => setAnswersMap(prev => ({ ...prev, [qa.id]: e.target.value }))}
                                />
                                <button
                                  onClick={() => handleAnswerSubmit(qa.id)}
                                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 text-xs font-black uppercase tracking-widest cursor-pointer whitespace-nowrap"
                                >
                                  Publicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {qas.length === 0 && (
                    <div className="py-20 text-center">
                      <HelpCircle className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                      <p className="font-black text-gray-300 italic uppercase tracking-widest">Sem perguntas recebidas ainda</p>
                      <p className="text-gray-400 text-xs font-medium max-w-sm mx-auto mt-2">Assim que os compradores enviarem uma dúvida na página dos seus produtos, elas aparecerão listadas aqui em tempo real.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">Store Settings</h1>
               <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm max-w-2xl">
                  <div className="space-y-8">
                     <div className="flex flex-col sm:flex-row items-center gap-8 pb-8 border-b border-gray-50">
                        <div 
                          className={cn(
                            "w-32 h-32 bg-gray-100 rounded-[32px] flex-shrink-0 relative overflow-hidden group border-2 transition-all duration-250 cursor-pointer",
                            isDraggingLogo ? "border-blue-500 border-dashed bg-blue-50 scale-105" : "border-transparent"
                          )}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingLogo(true);
                          }}
                          onDragLeave={() => {
                            setIsDraggingLogo(false);
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setIsDraggingLogo(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              await handleLogoFile(file);
                            }
                          }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                           {store?.logo ? <img src={store.logo} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center font-black text-4xl text-gray-300 bg-gray-50">{store?.businessName[0]}</div>}
                           <div 
                             className={cn(
                               "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center text-white font-bold text-xs",
                               uploadingLogo || isDraggingLogo ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                             )}
                           >
                              {uploadingLogo ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                              ) : (
                                <Upload className="w-6 h-6" />
                              )}
                           </div>
                           <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             accept="image/*"
                             onChange={handleLogoUpload}
                           />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                           <h4 className="text-xl font-black text-gray-900 italic mb-2">{store?.businessName}</h4>
                           <p className="text-gray-400 font-medium text-sm mb-4">{t('seller.settings_desc', 'You can update your store identity and preferences here.')}</p>
                           <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                             <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                               {CATEGORIES.find(c => c.id === store?.category)?.translationKey ? t(CATEGORIES.find(c => c.id === store?.category)!.translationKey!) : store?.category}
                             </span>
                           </div>
                           {logoError && (
                             <p className="text-red-500 text-xs font-bold mt-2 text-center sm:text-left duration-200 animate-pulse bg-red-50 border border-red-100 rounded-lg px-3 py-1 bg-opacity-70 inline-block">{logoError}</p>
                           )}
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">{t('seller.whatsapp_support')}</label>
                           <input 
                              type="text" 
                              className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                              value={settingsForm.whatsappNumber}
                              onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })}
                           />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between ml-4">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('seller.business_location', 'Business Location')}</label>
                            <button 
                              type="button"
                              onClick={handleUseCurrentLocation}
                              disabled={locating}
                              className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                            >
                              {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                              {settingsForm.latitude ? 'GPS Active' : 'Update GPS'}
                            </button>
                          </div>
                          <input 
                             type="text" 
                             className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                             value={settingsForm.location}
                             placeholder="Ex: Maputo, Bairro Central"
                             onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })}
                          />
                          {settingsForm.latitude && (
                            <p className="text-[9px] font-bold text-green-600 ml-4 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> GPS mapped for smart-routing support
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">{t('seller.business_description')}</label>
                           <textarea 
                              className="w-full px-6 py-4 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] font-medium text-sm resize-none"
                              value={settingsForm.description}
                              onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                           />
                        </div>
                        <button 
                          onClick={handleSaveSettings}
                          disabled={savingSettings}
                          className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black hover:bg-black transition-all italic flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
                        >
                          {savingSettings && <Loader2 className="w-5 h-5 animate-spin" />}
                          {savingSettings ? t('seller.saving') : t('seller.save_changes')}
                        </button>
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'promotions' && (
            <motion.div
              key="promotions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">Gestor de Promoções & Cupons</h1>
                  <p className="text-gray-400 font-medium text-sm mt-1">Crie descontos, ofertas relâmpago, pacotes especiais e cupons de compras para a sua loja.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Promotion Form Card */}
                <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm space-y-6 lg:col-span-1 h-fit">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 italic">Nova Promoção</h3>
                    <p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wider">Criar Oferta Competitiva</p>
                  </div>

                  <form onSubmit={handleCreatePromotion} className="space-y-5 text-left">
                    {/* Promotion Type Pills */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Promoção</label>
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                        {(['discount', 'flash_sale', 'bundle', 'coupon'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPromoType(t)}
                            className={cn(
                              "py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center",
                              promoType === t ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-900"
                            )}
                          >
                            {t === 'discount' ? 'Desconto' : t === 'flash_sale' ? 'Relâmpago' : t === 'bundle' ? 'Pacote' : 'Cupom'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-450 mt-1 font-semibold italic text-center leading-normal">
                        {promoType === 'discount' && 'Desconto padrão aplicado permanentemente nos produtos.'}
                        {promoType === 'flash_sale' && 'Oferta relâmpago cronometrada com contagem decrescente ao vivo.'}
                        {promoType === 'bundle' && 'Compre mais por menos (p. ex: compre 2 receba 1).'}
                        {promoType === 'coupon' && 'Gera cupons de desconto manuais ou automáticos.'}
                      </p>
                    </div>

                    {/* Promotion Name */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome/Etiqueta da Promoção *</label>
                      <input 
                        type="text" 
                        value={promoLabel}
                        onChange={(e) => setPromoLabel(e.target.value)}
                        placeholder="Ex: Saldos de Verão, Flash de Sexta, Pack Economia"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm text-gray-900"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Discount % */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Desconto (%) *</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="100"
                          value={promoDiscount}
                          onChange={(e) => setPromoDiscount(parseInt(e.target.value, 10) || 15)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-bold text-sm text-gray-900"
                          required
                        />
                      </div>

                      {/* Usage Limit */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Limite Uso (Opcional)</label>
                        <input 
                          type="number" 
                          min="1"
                          placeholder="Sem limite"
                          value={promoUsageLimit}
                          onChange={(e) => setPromoUsageLimit(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm text-gray-900"
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Data de Início *</label>
                        <input 
                          type="datetime-local" 
                          value={promoStartDate}
                          onChange={(e) => setPromoStartDate(e.target.value)}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-xl transition-all outline-none text-xs font-bold text-gray-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Data de Fim *</label>
                        <input 
                          type="datetime-local" 
                          value={promoEndDate}
                          onChange={(e) => setPromoEndDate(e.target.value)}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-xl transition-all outline-none text-xs font-bold text-gray-800"
                          required
                        />
                      </div>
                    </div>

                    {/* Applicable Products Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Produtos Aplicáveis *</label>
                        <button 
                          type="button" 
                          onClick={() => setPromoProducts(products.map(p => p.id))}
                          className="text-[9px] text-blue-600 font-extrabold uppercase hover:underline"
                        >
                          Selecionar Todos
                        </button>
                      </div>
                      
                      <div className="max-h-40 overflow-y-auto border border-gray-100 bg-gray-50 rounded-2xl p-3.5 space-y-2">
                        {products.length > 0 ? (
                          products.map(prod => {
                            const isChecked = promoProducts.includes(prod.id);
                            return (
                              <label key={prod.id} className="flex items-center gap-2.5 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-xs font-extrabold text-gray-800">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setPromoProducts(promoProducts.filter(id => id !== prod.id));
                                    } else {
                                      setPromoProducts([...promoProducts, prod.id]);
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                                />
                                <span className="line-clamp-1 flex-1">{prod.name}</span>
                                <span className="text-[10px] text-gray-400 bg-gray-150 px-2 py-0.5 rounded-full">{formatCurrency(prod.price, store.currency)}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-[10px] text-gray-400 italic font-bold py-4 text-center">Nenhum produto cadastrado nesta loja.</p>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 font-semibold mt-1">Selecionado(s): <span className="font-bold text-blue-600">{promoProducts.length}</span> / {products.length} produtos.</p>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      className="w-full py-4 bg-blue-600 text-white rounded-[20px] font-black hover:bg-blue-700 transition-all text-xs uppercase tracking-widest italic flex items-center justify-center gap-2 shadow-lg shadow-blue-100 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Criar Promoção
                    </button>
                  </form>
                </div>

                {/* Promotions and Coupons Tables */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Active Promotions List */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 italic">Lista de Promoções</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">Campanhas Ativas & Anteriores</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase font-black text-[9px] tracking-widest bg-gray-50">
                            <th className="py-3 px-4">Campanha</th>
                            <th className="py-3 px-4">Tipo</th>
                            <th className="py-3 px-3">Desconto</th>
                            <th className="py-3 px-4">Duração</th>
                            <th className="py-3 px-4">Uso</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {promotions.length > 0 ? (
                            promotions.map(p => {
                              const currentDate = new Date();
                              const isPast = new Date(p.endDate) < currentDate;
                              return (
                                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="py-3.5 px-4 font-black text-gray-900">
                                    <div className="font-extrabold">{p.label}</div>
                                    <div className="text-[9px] text-gray-400 normal-case font-bold mt-0.5">{p.applicableProductIds.length} produtos incluídos</div>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                      p.type === 'discount' ? "bg-blue-105 bg-blue-50 text-blue-700" :
                                      p.type === 'flash_sale' ? "bg-amber-105 bg-amber-50 text-amber-700" :
                                      p.type === 'bundle' ? "bg-purple-105 bg-purple-50 text-purple-700" :
                                      "bg-pink-105 bg-pink-50 text-pink-700"
                                    )}>
                                      {p.type === 'discount' ? 'Desconto' :
                                       p.type === 'flash_sale' ? 'Relâmpago' :
                                       p.type === 'bundle' ? 'Pacote' : 'Cupom'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3 font-black text-gray-900">{p.discountPercentage}% OFF</td>
                                  <td className="py-3.5 px-4 text-gray-500 font-bold whitespace-nowrap">
                                    <div className="text-[10px]">{new Date(p.startDate).toLocaleDateString()} a</div>
                                    <div className="text-[10px]">{new Date(p.endDate).toLocaleDateString()}</div>
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-gray-705">
                                    {p.usageLimit ? `${p.usageCount} / ${p.usageLimit}` : `${p.usageCount} uso(s)`}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    {isPast ? (
                                      <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">Expirado</span>
                                    ) : p.isActive ? (
                                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">Ativo</span>
                                    ) : (
                                      <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">Inativo</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <button 
                                        type="button"
                                        onClick={() => handleDeactivatePromotion(p.id, p.isActive)}
                                        disabled={isPast}
                                        title={isPast ? "Campanha Expirada" : "Ativar/Desativar Campanha"}
                                        className={cn(
                                          "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all border cursor-pointer",
                                          isPast ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" :
                                          p.isActive ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" :
                                          "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                        )}
                                      >
                                        {p.isActive ? 'Pausa' : 'Ativar'}
                                      </button>
                                      
                                      <button 
                                        type="button"
                                        onClick={() => handleOpenCouponModal(p.id)}
                                        disabled={isPast}
                                        className={cn(
                                          "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer",
                                          isPast && "opacity-50 cursor-not-allowed"
                                        )}
                                      >
                                        Criar Cupom
                                      </button>

                                      <button 
                                        type="button"
                                        onClick={() => handleDeletePromotion(p.id)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-gray-400 font-bold italic">Nenhuma promoção encontrada. Crie uma nova promoção na barra lateral esquerda!</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Coupons Linked to active promotions */}
                  <div className="bg-white p-6 sm:p-8 rounded-[38px] border border-gray-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 italic">Cupons de Desconto Gerados</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">Cupons Relacionados às Promoções</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase font-black text-[9px] tracking-widest bg-gray-50">
                            <th className="py-3 px-4">Código de Cupom</th>
                            <th className="py-3 px-4">Campanha</th>
                            <th className="py-3 px-4 font-bold">Desconto</th>
                            <th className="py-3 px-3">Expiração</th>
                            <th className="py-3 px-4">Uso (Consumo)</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {coupons.filter(c => promotions.map(p => p.id).includes(c.promotionId)).length > 0 ? (
                            coupons.filter(c => promotions.map(p => p.id).includes(c.promotionId)).map(c => {
                              const relatedPromo = promotions.find(p => p.id === c.promotionId);
                              const isPast = new Date(c.expiryDate) < new Date();
                              return (
                                <tr key={c.code} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <span className="font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded inline-block text-[11px] select-all uppercase">
                                      {c.code}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-gray-905">
                                    {relatedPromo ? relatedPromo.label : 'Campanha Removida'}
                                  </td>
                                  <td className="py-3.5 px-4 font-black text-gray-905">
                                    {c.discountPercentage}% OFF
                                  </td>
                                  <td className="py-3.5 px-3 text-gray-500 font-bold whitespace-nowrap">
                                    {new Date(c.expiryDate).toLocaleDateString()}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-col gap-1 w-24">
                                      <div className="flex justify-between items-center text-[10px] text-gray-550 font-bold">
                                        <span>{c.usageCount} / {c.usageLimit || '∞'}</span>
                                      </div>
                                      {c.usageLimit && (
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-blue-550 bg-blue-600 transition-all rounded-full"
                                            style={{ width: `${Math.min(100, (c.usageCount / c.usageLimit) * 100)}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    {isPast ? (
                                      <span className="bg-gray-101 bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">Expirado</span>
                                    ) : c.isActive ? (
                                      <span className="bg-emerald-105 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">Ativo</span>
                                    ) : (
                                      <span className="bg-rose-105 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">Inativo</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <button 
                                        type="button"
                                        onClick={() => handleToggleCouponActive(c.code, c.isActive)}
                                        disabled={isPast}
                                        className={cn(
                                          "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all border cursor-pointer",
                                          isPast ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" :
                                          c.isActive ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" :
                                          "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                        )}
                                      >
                                        {c.isActive ? 'Pausa' : 'Ativar'}
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => handleDeleteCoupon(c.code)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-gray-400 font-bold italic">Nenhum cupom gerado para as suas promoções.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'finance' && (
            <motion.div
              key="finance"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 italic tracking-tight flex items-center gap-2">
                    <Wallet className="w-8 h-8 text-blue-600 shrink-0" />
                    Minhas Finanças & Payouts
                  </h1>
                  <p className="text-gray-400 font-medium text-sm mt-1">
                    Gerencie o seu faturamento, acompanhe comissões e solicite levantamentos de saldo.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-gray-100 p-1 rounded-2xl flex items-center justify-around border border-gray-150 inline-flex">
                    {(['MZN', 'USD', 'ZAR'] as const).map((curr) => (
                      <button
                        key={curr}
                        onClick={() => {
                          setFinanceCurrency(curr);
                          setTransactionsPage(1);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                          financeCurrency === curr 
                            ? "bg-white text-blue-600 shadow-sm" 
                            : "text-gray-400 hover:text-gray-900"
                        )}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setWithdrawalAmount('');
                      setWithdrawalAccount('');
                      setWithdrawalMethod('mpesa');
                      setWithdrawalSubmitStatus('idle');
                      setWithdrawalModalOpen(true);
                    }}
                    className="px-6 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 cursor-pointer"
                  >
                    <Landmark className="w-4 h-4" />
                    Solicitar Levantamento
                  </button>
                </div>
              </div>

              {/* Cards Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: "Total de Ganhos",
                    key: "totalEarned",
                    color: "text-green-600",
                    value: payoutSummary ? getConvertedAmount(payoutSummary.totalEarned, payoutSummary.currency) : 0,
                    subtitle: "Receita líquida total gerada"
                  },
                  {
                    title: "Saldo Disponível",
                    key: "availableBalance",
                    color: "text-blue-600",
                    value: payoutSummary ? getConvertedAmount(payoutSummary.availableBalance, payoutSummary.currency) : 0,
                    subtitle: "Pronto para retirar"
                  },
                  {
                    title: "Em Processamento",
                    key: "totalPending",
                    color: "text-orange-500",
                    value: payoutSummary ? getConvertedAmount(payoutSummary.totalPending || 0, payoutSummary.currency) : 0,
                    subtitle: "Levantamento pendente"
                  },
                  {
                    title: "Total Retirado",
                    key: "totalWithdrawn",
                    color: "text-purple-600",
                    value: payoutSummary ? getConvertedAmount(payoutSummary.totalWithdrawn || 0, payoutSummary.currency) : 0,
                    subtitle: "Valor pago com sucesso"
                  }
                ].map((card) => (
                  <div key={card.title} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{card.title}</p>
                    <p className={cn("text-2xl font-black italic tracking-tight", card.color)}>
                      {formatFinanceCurrency(card.value, financeCurrency)}
                    </p>
                    <p className="text-gray-400 text-[10px] font-semibold">{card.subtitle}</p>
                  </div>
                ))}
              </div>

              {payoutSummary && (
                <div className="p-4 bg-blue-50/20 border border-blue-50/50 rounded-2xl flex items-center justify-between text-xs text-blue-700 font-semibold">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <span>Seu registo financeiro principal está em <span className="font-extrabold uppercase">{payoutSummary.currency || 'MZN'}</span></span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full uppercase tracking-wider font-extrabold">Taxa Base: {getCommissionRate(store)}%</span>
                </div>
              )}

              {/* Transactions Table Section */}
              <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between flex-wrap gap-4">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider italic">Histórico de Transações</h3>
                  <p className="text-xs font-semibold text-gray-400">{payoutTransactions.length} registros no total</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">ID / Referência</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Data</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Valor Original</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Valor em ({financeCurrency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payoutTransactions.length > 0 ? (
                        payoutTransactions.slice((transactionsPage - 1) * 10, transactionsPage * 10).map((tx) => {
                          const convertedAmt = getConvertedAmount(tx.amount, tx.currency);
                          return (
                            <tr key={tx.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="px-8 py-5 font-mono text-[10px] font-bold text-gray-400 uppercase">
                                {tx.id.substring(0, 14)}...
                              </td>
                              <td className="px-8 py-5">
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest",
                                  tx.type === 'earning' ? "bg-green-50 text-green-700" :
                                  tx.type === 'commission_deduction' ? "bg-red-50 text-red-700" :
                                  tx.type === 'withdrawal' ? "bg-purple-50 text-purple-700" :
                                  "bg-gray-55/60 text-gray-700"
                                )}>
                                  {tx.type === 'earning' ? 'Ganho' :
                                   tx.type === 'commission_deduction' ? 'Comissão' :
                                   tx.type === 'withdrawal' ? 'Levantamento' : tx.type}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-gray-900 text-xs font-bold">
                                {tx.description}
                              </td>
                              <td className="px-8 py-5 text-gray-450 text-xs font-medium">
                                {new Date(tx.timestamp).toLocaleString('pt-PT')}
                              </td>
                              <td className="px-8 py-5">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest",
                                  tx.status === 'completed' ? "text-green-600" :
                                  tx.status === 'pending' ? "text-orange-500 animate-pulse" :
                                  "text-red-600"
                                )}>
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    tx.status === 'completed' ? "bg-green-600" :
                                    tx.status === 'pending' ? "bg-orange-500" :
                                    "bg-red-600"
                                  )} />
                                  {tx.status === 'completed' ? 'Completado' :
                                   tx.status === 'pending' ? 'Pendente' : 'Falhou'}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-right font-black text-gray-400 text-xs">
                                {formatFinanceCurrency(tx.amount, tx.currency)}
                              </td>
                              <td className="px-8 py-5 text-right font-black text-gray-900 text-xs">
                                {formatFinanceCurrency(convertedAmt, financeCurrency)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-20 text-center text-gray-300 font-bold italic uppercase tracking-wider">
                            Nenhuma transação financeira registrada até o momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {payoutTransactions.length > 10 && (
                  <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                      disabled={transactionsPage === 1}
                      onClick={() => setTransactionsPage(p => Math.max(1, p - 1))}
                      className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-white rounded-xl border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      Anterior
                    </button>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Página {transactionsPage} de {Math.ceil(payoutTransactions.length / 10)}
                    </span>
                    <button
                      disabled={transactionsPage >= Math.ceil(payoutTransactions.length / 10)}
                      onClick={() => setTransactionsPage(p => Math.min(Math.ceil(payoutTransactions.length / 10), p + 1))}
                      className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-white rounded-xl border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ManageVariantsModal
        isOpen={isVariantsModalOpen}
        onClose={() => {
          setIsVariantsModalOpen(false);
          setSelectedProductForVariants(null);
        }}
        product={selectedProductForVariants}
      />
      {store && (
        <AddProductModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)}
          store={store}
        />
      )}
      {store && (
        <ImportCSVModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          store={store}
        />
      )}

      {/* 4. EDIT PRODUCT MODAL */}
      <AnimatePresence>
        {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[40px] border border-gray-100 shadow-2xl p-6 sm:p-10 max-w-lg w-full relative my-8"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight italic">Editar Produto</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Modificar Item no Catálogo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditProductSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome do Produto *</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Preço de Custo (Purchasing Price) *</label>
                    <input 
                      type="number" 
                      value={editForm.purchasingPrice}
                      onChange={(e) => setEditForm(prev => ({ ...prev, purchasingPrice: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                      min={0}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Preço de Venda (Selling Price) ({store?.currency || 'MZN'}) *</label>
                    <input 
                      type="number" 
                      value={editForm.price}
                      onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                      min={0}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 bg-gray-50/50 p-5 rounded-3xl border border-gray-100">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock em Unidades / Stock Units</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Registe o stock restante</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Cx (Caixas)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                        placeholder="0"
                        min="0"
                        value={editForm.unitCxStock}
                        onChange={(e) => setEditForm(prev => ({ ...prev, unitCxStock: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Emb (Emballage)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                        placeholder="0"
                        min="0"
                        value={editForm.unitEmbStock}
                        onChange={(e) => setEditForm(prev => ({ ...prev, unitEmbStock: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Un (Unidade)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                        placeholder="0"
                        min="0"
                        value={editForm.unitUnStock}
                        onChange={(e) => setEditForm(prev => ({ ...prev, unitUnStock: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Wholesale Special Prices Editor */}
                <div className="space-y-3 bg-blue-50/40 p-5 rounded-3xl border border-blue-100/30">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Preços Especiais de Atacado (Wholesale Tiers)</label>
                    <button 
                      type="button"
                      onClick={addEditTier}
                      className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3" /> Adicionar Escalão
                    </button>
                  </div>
                  
                  {editWholesaleTiers.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {editWholesaleTiers.map((tier, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="number" 
                            placeholder="Qtd Min"
                            className="flex-1 px-4 py-3 bg-white border border-gray-150 rounded-xl text-xs font-bold text-center"
                            value={tier.minQuantity}
                            onChange={(e) => updateEditTier(idx, 'minQuantity', e.target.value)}
                            min="1"
                            required
                          />
                          <input 
                            type="number" 
                            placeholder={`Preço (${store?.currency || 'MZN'})`}
                            className="flex-1 px-4 py-3 bg-white border border-gray-150 rounded-xl text-xs font-bold text-center"
                            value={tier.price}
                            onChange={(e) => updateEditTier(idx, 'price', e.target.value)}
                            min="0"
                            required
                          />
                          <button 
                            type="button" 
                            onClick={() => removeEditTier(idx)}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-gray-100/50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic font-bold ml-2">Nenhum escalão de atacado adicionado.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoria *</label>
                    <input 
                      type="text" 
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Ex: Snacks, Tecidos, Perfumaria"
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">URL da Imagem</label>
                    <input 
                      type="url" 
                      value={editForm.imageUrl}
                      onChange={(e) => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descrição Detalhada</label>
                  <textarea 
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-2xl transition-all outline-none font-medium h-24 resize-none text-sm"
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-50">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={savingProduct}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. CREATE COUPON MODAL */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[40px] border border-gray-100 shadow-2xl p-6 sm:p-10 max-w-sm w-full relative"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight italic">Criar Cupom</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Vincular a promoção</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCouponModalOpen(false)}
                  className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-6 text-left">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Código Personalizado (Opcional)</label>
                  <input 
                    type="text" 
                    value={customCouponCode}
                    onChange={(e) => setCustomCouponCode(e.target.value)}
                    placeholder="Ex: PROMO2026 (gerar auto se vazio)"
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-sm tracking-wider uppercase text-gray-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Limite de Uso (Opcional)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={couponUsageLimit}
                    onChange={(e) => setCouponUsageLimit(e.target.value)}
                    placeholder="Deixe em branco para uso ilimitado"
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-medium text-sm text-gray-950"
                  />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-2xl text-xs text-blue-900 leading-relaxed font-medium border border-blue-100/55">
                  Este cupom herda o desconto de <span className="font-bold">{promotions.find(p => p.id === couponPromotionId)?.discountPercentage}% OFF</span> e data de validade da campanha associada.
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-50">
                  <button 
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Gerar Cupom
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. REQUEST WITHDRAWAL MODAL */}
      <AnimatePresence>
        {withdrawalModalOpen && (
          <div className="fixed inset-0 z-[999] overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (withdrawalSubmitStatus !== 'submitting') {
                  setWithdrawalModalOpen(false);
                }
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white w-full max-w-lg rounded-[36px] overflow-hidden shadow-2xl relative z-10 border border-gray-100 p-8 sm:p-10"
            >
              <button
                type="button"
                disabled={withdrawalSubmitStatus === 'submitting'}
                onClick={() => setWithdrawalModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {withdrawalSubmitStatus === 'success' ? (
                <div className="text-center space-y-6 py-6">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mx-auto">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-gray-900 italic tracking-tight">Pedido Enviado!</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Request Submitted</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 max-w-sm mx-auto text-center space-y-2">
                    <p className="text-xs text-gray-600 font-bold leading-normal">
                      O seu levantamento está em processamento e foi temporariamente reservado no saldo pendente.
                    </p>
                    <p className="text-xs text-blue-600 font-black uppercase tracking-wider">
                      Tempo estimado: 2 a 3 dias úteis
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawalModalOpen(false)}
                    className="w-full py-4 bg-gray-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-black transition-all cursor-pointer"
                  >
                    Entendido / Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleWithdrawalSubmit} className="space-y-6 text-left">
                  <div>
                    <h2 className="text-2.5xl font-black text-gray-900 italic tracking-tight flex items-center gap-2">
                      <Landmark className="w-6 h-6 text-blue-600" />
                      Solicitar Levantamento
                    </h2>
                    <p className="text-gray-400 text-xs font-semibold mt-1">
                      Transfira os seus ganhos de forma segura para os canais moçambicanos disponíveis.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/35 flex items-center justify-between text-xs font-bold text-blue-800">
                    <span>Saldo Disponível:</span>
                    <span>{formatFinanceCurrency(payoutSummary?.availableBalance || 0, payoutSummary?.currency || 'MZN')}</span>
                  </div>

                  {/* Input field: Amount */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-450 block">Valor a levantar ({payoutSummary?.currency || 'MZN'}) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="Ex: 500"
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-2xl text-sm font-black outline-none transition-all text-gray-900"
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-450 block">Canal de Pagamento / Payment Method *</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'mpesa', label: 'M-Pesa' },
                        { id: 'emola', label: 'e-Mola' },
                        { id: 'bank', label: 'Banco' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setWithdrawalMethod(item.id as any)}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                            withdrawalMethod === item.id 
                              ? "bg-blue-50 border-blue-200 text-blue-705 font-extrabold" 
                              : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input field: Account Details */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-450 block">
                      {withdrawalMethod === 'bank' ? 'Dados Bancários (NIB / IBAN, Banco) *' : 'Contacto de Telefone Registado *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={withdrawalAccount}
                      onChange={(e) => setWithdrawalAccount(e.target.value)}
                      placeholder={withdrawalMethod === 'bank' ? 'Ex: 0001 0000 1234 5678 9012 3 - BCI' : 'Ex: 841234567'}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
                    />
                  </div>

                  <div className="text-[10px] text-gray-400 italic font-medium leading-relaxed">
                    * Os fundos serão processados e debitados no canal solicitado. Recomenda-se a verificação meticulosa dos detalhes da conta para evitar perdas irrecorríveis.
                  </div>

                  {/* Submission triggers */}
                  <button
                    type="submit"
                    disabled={withdrawalSubmitStatus === 'submitting'}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {withdrawalSubmitStatus === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {withdrawalSubmitStatus === 'submitting' ? 'A enviar pedido...' : 'Confirmar & Solicitar'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
