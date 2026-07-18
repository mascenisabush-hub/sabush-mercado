import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, doc, updateDoc, onSnapshot, orderBy, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { UserProfile, Store, Order, UserRole } from '../types';
import { 
  Users, Shield, ShieldOff, Search, Filter, Ban, CheckCircle, 
  Store as StoreIcon, ShoppingBag, BarChart3, AlertTriangle,
  MoreVertical, Check, X, Eye, Flag, LogOut, Package, Trash2,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, parseFirestoreError } from '../lib/firebaseErrors';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../components/common/RouteLink';
import { useTranslation } from 'react-i18next';
import { COUNTRIES } from '../constants';

type AdminTab = 'overview' | 'users' | 'stores' | 'listings' | 'orders' | 'reports' | 'owners' | 'withdrawals';

export function AdminPanel() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState<string>('all');

  const [reportsError, setReportsError] = useState(false);

  // Sorting and Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterValue]);

  // Set default sorting based on tab
  useEffect(() => {
    if (activeTab === 'users') {
      setSortColumn('displayName');
      setSortDirection('asc');
    } else if (activeTab === 'owners') {
      setSortColumn('displayName');
      setSortDirection('asc');
    } else if (activeTab === 'stores') {
      setSortColumn('businessName');
      setSortDirection('asc');
    } else if (activeTab === 'listings') {
      setSortColumn('name');
      setSortDirection('asc');
    } else if (activeTab === 'orders') {
      setSortColumn('createdAt');
      setSortDirection('desc');
    } else if (activeTab === 'reports') {
      setSortColumn('createdAt');
      setSortDirection('desc');
    } else if (activeTab === 'withdrawals') {
      setSortColumn('requestedAt');
      setSortDirection('desc');
    }
  }, [activeTab]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    // Listen to Users
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() })) as UserProfile[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Listen to Stores
    const storesQ = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
    const unsubscribeStores = onSnapshot(storesQ, (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Store[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stores'));

    // Listen to Orders
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Order[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Listen to Products
    const productsQ = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    // Listen to Reports
    const reportsQ = query(collection(db, 'reports'));
    const unsubscribeReports = onSnapshot(reportsQ, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
      setReportsError(false);
    }, (error) => {
      console.error("Reports listener failed:", error);
      setLoading(false);
      setReportsError(true);
      // We don't throw here to avoid crashing the whole panel if one collection fails
    });

    // Listen to withdrawal requests
    const withdrawalsQ = query(collection(db, 'withdrawalRequests'));
    const unsubscribeWithdrawals = onSnapshot(withdrawalsQ, (snapshot) => {
      setWithdrawalRequests(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (error) => {
      console.error("Withdrawal requests listener failed:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeStores();
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeReports();
      unsubscribeWithdrawals();
    };
  }, []);

  const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isBanned: !currentBanStatus });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to remove this listing?')) return;
    try {
      await updateDoc(doc(db, 'products', productId), { status: 'removed' });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleUpdateStoreStatus = async (storeId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), { status });
      const storeSnap = await getDoc(doc(db, 'stores', storeId));
      if (storeSnap.exists()) {
        const ownerId = storeSnap.data().ownerId;
        if (ownerId) {
          await updateDoc(doc(db, 'users', ownerId), {
            role: 'seller',
            sellerStatus: status
          });
        }
      }
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleVerifyStore = async (storeId: string, isVerified: boolean) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), { isVerified: !isVerified });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleToggleVerifiedBusiness = async (storeId: string, isVerifiedBusiness: boolean) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), { isVerifiedBusiness: !isVerifiedBusiness });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const handleResolveWithdrawal = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const requestRef = doc(db, 'withdrawalRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        alert("Pedido de levantamento não encontrado.");
        return;
      }
      
      const reqData = requestSnap.data();
      if (reqData.status !== 'pending') {
        alert("Este pedido já foi resolvido.");
        return;
      }
      
      const sellerId = reqData.sellerId;
      const amount = Number(reqData.amount);
      const currency = reqData.currency || 'MZN';
      const paymentMethod = reqData.paymentMethod || 'mpesa';
      const accountDetails = reqData.accountDetails || '';
      
      await updateDoc(requestRef, {
        status,
        resolvedAt: new Date().toISOString()
      });
      
      const payoutRef = doc(db, 'payouts', sellerId);
      const payoutSnap = await getDoc(payoutRef);
      if (payoutSnap.exists()) {
        const payoutData = payoutSnap.data();
        const currentPending = Number(payoutData.totalPending || 0);
        const currentWithdrawn = Number(payoutData.totalWithdrawn || 0);
        const currentAvail = Number(payoutData.availableBalance || 0);
        
        if (status === 'approved') {
          await updateDoc(payoutRef, {
            totalPending: Math.max(0, currentPending - amount),
            totalWithdrawn: currentWithdrawn + amount,
            lastUpdated: new Date().toISOString()
          });
          
          // Log a transaction inside seller's payouts
          const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await setDoc(doc(db, 'payouts', sellerId, 'transactions', txId), {
            id: txId,
            type: 'withdrawal',
            amount: amount,
            currency: currency,
            status: 'completed',
            description: `Levantamento (${paymentMethod}) para ${accountDetails}`,
            timestamp: new Date().toISOString()
          });
          
          // Send notification
          await addDoc(collection(db, 'notifications'), {
            userId: sellerId,
            title: "Levantamento Aprovado!",
            message: `O seu pedido de levantamento de ${amount} MT via ${paymentMethod.toUpperCase()} foi aprovado e processado com sucesso.`,
            type: "withdrawal_approved",
            read: false,
            createdAt: new Date().toISOString()
          });
        } else {
          // Refund
          await updateDoc(payoutRef, {
            totalPending: Math.max(0, currentPending - amount),
            availableBalance: currentAvail + amount,
            lastUpdated: new Date().toISOString()
          });
          
          // Transaction
          const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await setDoc(doc(db, 'payouts', sellerId, 'transactions', txId), {
            id: txId,
            type: 'withdrawal_refund',
            amount: amount,
            currency: currency,
            status: 'completed',
            description: `Levantamento (${paymentMethod}) Rejeitado \& Reembolsado`,
            timestamp: new Date().toISOString()
          });
          
          // Send notification
          await addDoc(collection(db, 'notifications'), {
            userId: sellerId,
            title: "Levantamento Rejeitado",
            message: `O seu pedido de levantamento de ${amount} MT via ${paymentMethod.toUpperCase()} foi rejeitado. O saldo correspondente foi devolvido ao seu saldo disponível.`,
            type: "withdrawal_rejected",
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      
      alert(`Levantamento ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`);
    } catch (error) {
      alert(parseFirestoreError(error));
    }
  };

  const filteredData = () => {
    switch (activeTab) {
      case 'users':
        return users.filter(u => 
          (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterValue === 'all' || u.role === filterValue)
        );
      case 'owners':
        return users
          .filter(u => {
            const hasStore = stores.some(s => s.ownerId === u.uid);
            return u.role === 'seller' || hasStore;
          })
          .map(u => {
            const userStore = stores.find(s => s.ownerId === u.uid);
            return {
              ...u,
              businessName: userStore?.businessName || 'Sem Empresa (No store yet)',
              whatsappNumber: userStore?.whatsappNumber || u.phoneNumber || 'N/A',
              storeStatus: userStore?.status || 'N/A'
            };
          })
          .filter(u => 
            (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
             u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.whatsappNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterValue === 'all' || u.storeStatus === filterValue)
          );
      case 'stores':
        return stores.filter(s => 
          (s.businessName.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterValue === 'all' || s.status === filterValue)
        );
      case 'listings':
        return products.filter(p => 
          (p.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterValue === 'all' || p.status === filterValue)
        );
      case 'orders':
        return orders.filter(o => 
          (o.id.toLowerCase().includes(searchTerm.toLowerCase()) || o.customerId.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterValue === 'all' || o.status === filterValue)
        );
      case 'reports':
        return reports.filter(r => 
          (r.targetId.toLowerCase().includes(searchTerm.toLowerCase()) || r.reason.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterValue === 'all' || r.status === filterValue)
        );
      case 'withdrawals':
        return withdrawalRequests
          .map(w => {
            const storeOfSeller = stores.find(s => s.ownerId === w.sellerId);
            const userOfSeller = users.find(u => u.uid === w.sellerId);
            return {
              ...w,
              sellerName: userOfSeller?.displayName || 'Unknown Seller',
              businessName: storeOfSeller?.businessName || 'No Store'
            };
          })
          .filter(w => 
            (w.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
             w.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             w.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             w.accountDetails.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filterValue === 'all' || w.status === filterValue)
          );
      default:
        return [];
    }
  };

  const getSortedAndFilteredData = () => {
    let data = filteredData();
    
    if (!sortColumn) return data;
    
    return [...data].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      
      // Resolve values based on sortColumn and activeTab
      if (activeTab === 'users') {
        valA = a[sortColumn as keyof UserProfile] ?? '';
        valB = b[sortColumn as keyof UserProfile] ?? '';
      } else if (activeTab === 'owners') {
        valA = a[sortColumn] ?? '';
        valB = b[sortColumn] ?? '';
      } else if (activeTab === 'stores') {
        valA = a[sortColumn as keyof Store] ?? '';
        valB = b[sortColumn as keyof Store] ?? '';
      } else if (activeTab === 'listings') {
        valA = a[sortColumn] ?? '';
        valB = b[sortColumn] ?? '';
      } else if (activeTab === 'orders') {
        valA = a[sortColumn as keyof Order] ?? '';
        valB = b[sortColumn as keyof Order] ?? '';
      } else if (activeTab === 'reports') {
        valA = a[sortColumn] ?? '';
        valB = b[sortColumn] ?? '';
      } else if (activeTab === 'withdrawals') {
        valA = a[sortColumn] ?? '';
        valB = b[sortColumn] ?? '';
      }

      // Handle Date sorting explicitly for 'createdAt', 'requestedAt', 'resolvedAt'
      if (sortColumn === 'createdAt' || sortColumn === 'requestedAt' || sortColumn === 'resolvedAt') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      
      // Handle price/totalAmount sorting explicitly as numbers
      if (sortColumn === 'price' || sortColumn === 'totalAmount') {
        const numA = typeof valA === 'number' ? valA : parseFloat(valA) || 0;
        const numB = typeof valB === 'number' ? valB : parseFloat(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      // Handle string comparison (case insensitive)
      if (typeof valA === 'string' && typeof valB === 'string') {
        const compareResult = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? compareResult : -compareResult;
      }
      
      // Handle boolean comparison ('isBanned', 'isVerified')
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        const numA = valA ? 1 : 0;
        const numB = valB ? 1 : 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      // Default fallback
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedAndFilteredData = getSortedAndFilteredData();
  const totalItems = sortedAndFilteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = sortedAndFilteredData.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3 italic">
            <Shield className="w-10 h-10 text-blue-600" /> Admin Command
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Platform governance and oversight dashboard.</p>
        </div>
        
        <div className="flex flex-col items-end gap-4">
          <button 
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-600 hover:border-red-100 transition-all shadow-sm group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {t('nav.logout')}
          </button>

          <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto whitespace-nowrap scrollbar-hide">
            {(['overview', 'users', 'stores', 'listings', 'orders', 'reports', 'owners', 'withdrawals'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFilterValue('all'); setSearchTerm(''); }}
              className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'owners' ? 'Business Owners' : tab === 'withdrawals' ? 'Levantamentos / Withdrawals' : tab}
            </button>
          ))}
        </div>
      </div>
    </div>

      {activeTab === 'overview' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 lg:grid-cols-6">
          <StatCard icon={<Users />} label="Users" value={users.length} color="blue" />
          <StatCard icon={<StoreIcon />} label="Stores" value={stores.length} color="purple" />
          <StatCard icon={<Package />} label="Listings" value={products.length} color="green" />
          <StatCard icon={<ShoppingBag />} label="Orders" value={orders.length} color="orange" />
          <StatCard icon={<Flag />} label="Reports" value={reports.filter(r => r.status === 'pending').length} color="red" />
          <StatCard icon={<Ban />} label="Banned" value={users.filter(u => u.isBanned).length} color="gray" />
        </div>

          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm mb-8">
            <h3 className="text-xl font-black text-gray-900 mb-6 italic">Global Revenue Analytics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COUNTRIES.map(country => {
                const countryRevenue = orders
                  .filter(o => o.status === 'delivered' && o.currency === country.currency)
                  .reduce((sum, o) => sum + o.totalAmount, 0);
                
                if (countryRevenue === 0 && orders.filter(o => o.country === country.code).length === 0) return null;

                return (
                  <div key={country.code} className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{country.flag}</span>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{country.name}</p>
                    </div>
                    <p className="text-xl font-black text-gray-900">{formatCurrency(countryRevenue, country.currency)}</p>
                    <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase">Delivered Sales</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab !== 'overview' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder={`Search ${activeTab === 'owners' ? 'business owners' : activeTab === 'withdrawals' ? 'levantamentos' : activeTab}...`}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select 
                className="bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <option value="all">All {activeTab === 'owners' ? 'Owners' : activeTab === 'withdrawals' ? 'Levantamentos' : activeTab}</option>
                {activeTab === 'owners' && (
                  <>
                    <option value="pending">Store: Pending</option>
                    <option value="active">Store: Active</option>
                    <option value="suspended">Store: Suspended</option>
                  </>
                )}
                {activeTab === 'users' && (
                  <>
                    <option value="customer">Customers</option>
                    <option value="seller">Sellers</option>
                    <option value="admin">Admins</option>
                  </>
                )}
                {activeTab === 'stores' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </>
                )}
                {activeTab === 'listings' && (
                  <>
                    <option value="active">Active</option>
                    <option value="removed">Removed</option>
                  </>
                )}
                {activeTab === 'orders' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
                {activeTab === 'reports' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="ignored">Ignored</option>
                  </>
                )}
                {activeTab === 'withdrawals' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'reports' && reportsError ? (
              <div className="p-12 text-center text-red-500 bg-red-50 m-6 rounded-2xl border border-red-100 flex flex-col items-center gap-3">
                <AlertTriangle className="w-10 h-10" />
                <div>
                  <p className="font-black italic">Collection Access Failed</p>
                  <p className="text-sm font-medium opacity-80">You might not have enough permissions to view user reports. Our team will verify your admin status.</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-[#f8fafc] border-b border-gray-100">
                  <tr>
                    {activeTab === 'users' && <UserTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'owners' && <OwnerTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'stores' && <StoreTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'listings' && <ListingTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'orders' && <OrderTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'reports' && <ReportTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                    {activeTab === 'withdrawals' && <WithdrawalTableHeaders sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  <AnimatePresence mode="popLayout">
                    {paginatedData.map((item: any, index: number) => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={item.uid || item.id} 
                        className={cn(
                          "transition-all duration-200 border-b border-[#f1f5f9] last:border-b-0",
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/30",
                          "hover:bg-blue-50/20 hover:shadow-[inset_3px_0_0_0_#3b82f6]"
                        )}
                      >
                        {activeTab === 'users' && <UserRow user={item} onToggleBan={handleToggleBan} onUpdateRole={handleUpdateRole} />}
                        {activeTab === 'owners' && <OwnerRow user={item} />}
                        {activeTab === 'stores' && <StoreRow store={item} onUpdateStatus={handleUpdateStoreStatus} onToggleVerify={handleVerifyStore} onToggleVerifiedBusiness={handleToggleVerifiedBusiness} />}
                        {activeTab === 'listings' && <ListingRow product={item} onDelete={handleDeleteProduct} />}
                        {activeTab === 'orders' && <OrderRow order={item} />}
                        {activeTab === 'reports' && <ReportRow report={item} onUpdateStatus={handleUpdateReportStatus} />}
                        {activeTab === 'withdrawals' && <WithdrawalRow request={item} onResolve={handleResolveWithdrawal} />}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
          
          {totalItems === 0 && (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-[30px] flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold">No results found.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Showing <span className="text-gray-700">{totalItems === 0 ? 0 : startIndex + 1}</span> to <span className="text-gray-700">{endIndex}</span> of <span className="text-gray-700">{totalItems}</span> {activeTab}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (
                      totalPages > 6 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(currentPage - pageNum) > 1
                    ) {
                      if (pageNum === 2 && currentPage > 3) {
                        return <span key="el1" className="px-2 text-xs font-bold text-gray-300">...</span>;
                      }
                      if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                        return <span key="el2" className="px-2 text-xs font-bold text-gray-300">...</span>;
                      }
                      return null;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "min-w-[32px] h-8 flex items-center justify-center text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                          currentPage === pageNum 
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-100" 
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RecentActivity title="Pending Verifications" 
            items={stores.filter(s => s.status === 'pending').slice(0, 5)} 
            renderItem={(s) => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{s.businessName}</p>
                    <p className="text-xs text-gray-500">{s.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('stores')}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50"
                >
                  Review
                </button>
              </div>
            )}
          />
          
          <RecentActivity title="Pending Reports" 
            items={reports.filter(r => r.status === 'pending').slice(0, 5)} 
            renderItem={(r) => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl mb-3 border-l-4 border-red-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{r.reason}</p>
                    <p className="text-xs text-gray-500">Target: {r.targetType} • {r.targetId.slice(10)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('reports')}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50"
                >
                  Investigate
                </button>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color as keyof typeof colors]}`}>
          {React.cloneElement(icon as any, { className: 'w-7 h-7' })}
        </div>
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{label}</p>
          <p className="text-3xl font-black text-gray-900 tracking-tighter">{value}</p>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ title, items, renderItem }: { title: string, items: any[], renderItem: (item: any) => React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
      <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2 italic">
        <BarChart3 className="w-6 h-6 text-blue-600" /> {title}
      </h2>
      <div className="min-h-[200px]">
        {items.length > 0 ? items.map(renderItem) : (
          <div className="flex flex-col items-center justify-center p-12 text-gray-300">
            <CheckCircle className="w-12 h-12 mb-2" />
            <p className="font-bold">All clear!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    confirmed: 'bg-blue-100 text-blue-700',
    processing: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    suspended: 'bg-red-100 text-red-700',
    resolved: 'bg-green-100 text-green-700',
    ignored: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

// Table Components
interface TableHeadersProps {
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (col: string) => void;
}

function SortableHeader({
  column,
  currentSort,
  direction,
  onSort,
  children,
  className = "",
  align = "left"
}: {
  column: string;
  currentSort: string;
  direction: 'asc' | 'desc';
  onSort: (col: string) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const isActive = currentSort === column;
  return (
    <th 
      className={cn(
        "px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest cursor-pointer select-none group hover:text-blue-600 transition-colors",
        isActive && "text-blue-600 font-extrabold",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      onClick={() => onSort(column)}
    >
      <div className={cn(
        "flex items-center gap-1",
        align === "right" && "justify-end",
        align === "center" && "justify-center"
      )}>
        {children}
        <span className="inline-flex transition-transform duration-200">
          {isActive ? (
            direction === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-blue-600" />
            ) : (
              <ArrowDown className="w-3 h-3 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );
}

function UserTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="displayName" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>User</SortableHeader>
      <SortableHeader column="role" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Role</SortableHeader>
      <SortableHeader column="isBanned" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
    </>
  );
}

function UserRow({ 
  user, 
  onToggleBan, 
  onUpdateRole 
}: { 
  user: UserProfile, 
  onToggleBan: (id: string, status: boolean) => void,
  onUpdateRole: (id: string, role: UserRole) => void
}) {
  return (
    <>
      <td className="px-6 py-5">
        <div className={`flex items-center gap-3 transition-opacity duration-200 ${user.isBanned ? 'opacity-60' : 'opacity-100'}`}>
          <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden border border-gray-100 shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
          </div>
          <div>
            <p className={`font-bold transition-all ${user.isBanned ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{user.displayName}</p>
            <p className="text-xs text-gray-400 font-medium">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="relative inline-flex items-center text-current">
          <select
            value={user.role}
            onChange={(e) => onUpdateRole(user.uid, e.target.value as UserRole)}
            className={cn(
              "appearance-none px-3.5 py-1.5 pr-8 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500",
              user.role === 'admin' 
                ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-200 focus:ring-purple-500' 
                : user.role === 'seller' 
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-200 focus:ring-blue-500' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 focus:ring-gray-400',
              user.isBanned ? 'opacity-50 pointer-events-none' : 'opacity-100'
            )}
            disabled={user.isBanned}
          >
            <option value="customer" className="bg-white text-gray-700">Customer</option>
            <option value="seller" className="bg-white text-blue-700">Seller</option>
            <option value="admin" className="bg-white text-purple-700">Admin</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-70">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        {user.isBanned ? (
          <span className="flex items-center gap-1.5 text-red-600 text-[10px] font-black uppercase tracking-widest">
            <ShieldOff className="w-4 h-4 text-red-500 animate-pulse" /> Banned
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-green-600 text-[10px] font-black uppercase tracking-widest">
            <CheckCircle className="w-4 h-4 text-green-500" /> Active
          </span>
        )}
      </td>
      <td className="px-6 py-5 text-right">
        {user.role !== 'admin' ? (
          <button 
            onClick={() => onToggleBan(user.uid, !!user.isBanned)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all duration-200 active:scale-95 ${
              user.isBanned 
                ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300' 
                : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300'
            }`}
          >
            {user.isBanned ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Unban
              </>
            ) : (
              <>
                <Ban className="w-3.5 h-3.5" />
                Ban
              </>
            )}
          </button>
        ) : (
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider italic">System Admin</span>
        )}
      </td>
    </>
  );
}

function StoreTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="businessName" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Store</SortableHeader>
      <SortableHeader column="isVerified" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Verification</SortableHeader>
      <SortableHeader column="status" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
    </>
  );
}

function ListingTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="name" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Product</SortableHeader>
      <SortableHeader column="storeId" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Store</SortableHeader>
      <SortableHeader column="price" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Price</SortableHeader>
      <SortableHeader column="status" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
    </>
  );
}

function ListingRow({ product, onDelete }: { product: any, onDelete: (id: string) => void }) {
  return (
    <>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
            {product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-2.5 text-gray-300" />}
          </div>
          <div>
            <p className="font-bold text-gray-900 line-clamp-1">{product.name}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.category}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-gray-600 truncate max-w-[120px]">{product.storeId}</p>
      </td>
      <td className="px-6 py-5">
        <p className="font-black text-gray-900">{formatCurrency(product.price, product.currency)}</p>
      </td>
      <td className="px-6 py-5"><StatusBadge status={product.status} /></td>
      <td className="px-6 py-5 text-right">
        {product.status !== 'removed' && (
          <button 
            onClick={() => onDelete(product.id)}
            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
            title="Remove Listing"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </td>
    </>
  );
}

function StoreRow({ 
  store, 
  onUpdateStatus, 
  onToggleVerify, 
  onToggleVerifiedBusiness 
}: { 
  store: Store, 
  onUpdateStatus: (id: string, s: string) => void, 
  onToggleVerify: (id: string, v: boolean) => void,
  onToggleVerifiedBusiness: (id: string, v: boolean) => void
}) {
  return (
    <>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden shadow-sm">
            {store.logo ? <img src={store.logo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-purple-100 text-purple-600 font-bold">{store.businessName[0]}</div>}
          </div>
          <div>
            <p className="font-bold text-gray-900">{store.businessName}</p>
            <p className="text-xs text-gray-500 font-medium">{store.category}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex flex-col gap-1.5 max-w-[120px]">
          {/* Badge 1: Core Gold/Standard Verified */}
          <button 
            onClick={() => onToggleVerify(store.id, !!store.isVerified)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
              store.isVerified 
                ? 'bg-green-50 border-green-200 text-green-700 font-extrabold' 
                : 'bg-white border-gray-150 text-gray-450 hover:bg-green-50 hover:text-green-600'
            }`}
          >
            {store.isVerified ? <Check className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
            {store.isVerified ? 'Gold Verified' : 'Standard'}
          </button>

          {/* Badge 2: Verified Business Badge */}
          <button 
            onClick={() => onToggleVerifiedBusiness(store.id, !!store.isVerifiedBusiness)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
              store.isVerifiedBusiness 
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-extrabold' 
                : 'bg-white border-gray-150 text-gray-450 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {store.isVerifiedBusiness ? <Check className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {store.isVerifiedBusiness ? 'Certified Biz' : 'No Business'}
          </button>
        </div>
      </td>
      <td className="px-6 py-5"><StatusBadge status={store.status} /></td>
      <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
        {store.status === 'pending' ? (
          <>
            <button 
              onClick={() => onUpdateStatus(store.id, 'active')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
              title="Approve Store"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button 
              onClick={() => onUpdateStatus(store.id, 'suspended')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
              title="Reject Store"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        ) : (
          <button 
            onClick={() => onUpdateStatus(store.id, store.status === 'suspended' ? 'active' : 'suspended')}
            className={`p-2 rounded-xl transition-all ${store.status === 'suspended' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
            title={store.status === 'suspended' ? "Reactivate" : "Suspend"}
          >
            {store.status === 'suspended' ? <CheckCircle className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
          </button>
        )}
      </td>
    </>
  );
}

function OrderTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="id" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Order ID</SortableHeader>
      <SortableHeader column="customerId" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Customer</SortableHeader>
      <SortableHeader column="totalAmount" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Total</SortableHeader>
      <SortableHeader column="status" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <SortableHeader column="createdAt" currentSort={sortColumn} direction={sortDirection} onSort={onSort} align="right">Date</SortableHeader>
    </>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <>
      <td className="px-6 py-5">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-bold text-gray-600 uppercase">#{order.id.slice(0, 8)}</p>
          {order.paymentSimulated && (
            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200/50">
              SIMULATED
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-gray-900 truncate max-w-[120px] font-mono">{order.customerId.slice(-6)}...</p>
      </td>
      <td className="px-6 py-5">
        <p className="font-black text-gray-900">{formatCurrency(order.totalAmount, order.currency)}</p>
      </td>
      <td className="px-6 py-5"><StatusBadge status={order.status} /></td>
      <td className="px-6 py-5 text-right">
        <p className="text-xs font-bold text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
      </td>
    </>
  );
}

function ReportTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="createdAt" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Report</SortableHeader>
      <SortableHeader column="targetType" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Target</SortableHeader>
      <SortableHeader column="reason" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Reason</SortableHeader>
      <SortableHeader column="status" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
    </>
  );
}

function ReportRow({ report, onUpdateStatus }: { report: any, onUpdateStatus: (id: string, s: string) => void }) {
  return (
    <>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-gray-500">From: {report.reporterId.slice(-6)}...</p>
        <p className="text-[10px] text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</p>
      </td>
      <td className="px-6 py-5">
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase tracking-widest mr-2">{report.targetType}</span>
        <span className="font-mono text-[10px] text-gray-500">{report.targetId.slice(-8)}</span>
      </td>
      <td className="px-6 py-5">
        <p className="font-bold text-gray-900">{report.reason}</p>
        {report.details && <p className="text-[10px] text-gray-500 line-clamp-1">{report.details}</p>}
      </td>
      <td className="px-6 py-5"><StatusBadge status={report.status} /></td>
      <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
        <button 
          onClick={() => onUpdateStatus(report.id, 'resolved')}
          className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
          title="Resolve"
        >
          <Check className="w-5 h-5" />
        </button>
        <button 
          onClick={() => onUpdateStatus(report.id, 'ignored')}
          className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all"
          title="Ignore"
        >
          <X className="w-5 h-5" />
        </button>
      </td>
    </>
  );
}

function OwnerTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="displayName" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Business Owner</SortableHeader>
      <SortableHeader column="businessName" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Business Name</SortableHeader>
      <SortableHeader column="whatsappNumber" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Phone / WhatsApp</SortableHeader>
      <SortableHeader column="email" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Email Address</SortableHeader>
      <SortableHeader column="createdAt" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Joined Date</SortableHeader>
      <SortableHeader column="storeStatus" currentSort={sortColumn} direction={sortDirection} onSort={onSort} align="right">Store Status</SortableHeader>
    </>
  );
}

function OwnerRow({ user }: { user: any }) {
  return (
    <>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            {user.displayName ? user.displayName[0].toUpperCase() : 'B'}
          </div>
          <div>
            <p className="font-bold text-gray-900">{user.displayName}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.role}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-2">
          <StoreIcon className="w-4 h-4 text-purple-500" />
          <p className="font-bold text-gray-800">{user.businessName}</p>
        </div>
      </td>
      <td className="px-6 py-5">
        <p className="font-mono text-xs font-bold text-gray-700">{user.whatsappNumber}</p>
      </td>
      <td className="px-6 py-5 font-mono text-xs text-gray-600">
        {user.email}
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-gray-500">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
        </p>
      </td>
      <td className="px-6 py-5 text-right">
        <StatusBadge status={user.storeStatus} />
      </td>
    </>
  );
}

function WithdrawalTableHeaders({ sortColumn, sortDirection, onSort }: TableHeadersProps) {
  return (
    <>
      <SortableHeader column="id" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>ID</SortableHeader>
      <SortableHeader column="sellerName" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Seller / Store</SortableHeader>
      <SortableHeader column="paymentMethod" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Channel</SortableHeader>
      <SortableHeader column="accountDetails" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Account Details</SortableHeader>
      <SortableHeader column="amount" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Amount</SortableHeader>
      <SortableHeader column="requestedAt" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Date Requested</SortableHeader>
      <SortableHeader column="status" currentSort={sortColumn} direction={sortDirection} onSort={onSort}>Status</SortableHeader>
      <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
    </>
  );
}

function WithdrawalRow({ request, onResolve }: { request: any, onResolve: (id: string, s: 'approved' | 'rejected') => void }) {
  const formatMtx = (amount: number, curr: string) => {
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

  return (
    <>
      <td className="px-6 py-5 font-mono text-[10px] font-extrabold text-gray-400 uppercase">
        {request.id.substring(0, 10)}...
      </td>
      <td className="px-6 py-5">
        <div>
          <p className="font-bold text-gray-900">{request.sellerName}</p>
          <p className="text-[10px] text-gray-400 font-semibold">{request.businessName}</p>
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-blue-50 text-blue-700">
          {request.paymentMethod}
        </span>
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-gray-700 max-w-[200px] truncate" title={request.accountDetails}>
          {request.accountDetails}
        </p>
      </td>
      <td className="px-6 py-5 flex items-center gap-1 mt-1">
        <p className="font-extrabold text-sm text-gray-900">
          {formatMtx(Number(request.amount), request.currency || 'MZN')}
        </p>
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-semibold text-gray-500">
          {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : 'N/A'}
        </p>
      </td>
      <td className="px-6 py-5">
        <StatusBadge status={request.status} />
      </td>
      <td className="px-6 py-5 text-right">
        {request.status === 'pending' ? (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onResolve(request.id, 'approved')}
              className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-150 transition-all cursor-pointer"
              title="Aprovar Levantamento"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => onResolve(request.id, 'rejected')}
              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-150 transition-all cursor-pointer"
              title="Rejeitar Levantamento"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : request.status === 'approved' ? (
          <span className="text-[10px] text-green-600 font-extrabold uppercase tracking-widest">Aprovado</span>
        ) : (
          <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest">Rejeitado</span>
        )}
      </td>
    </>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

