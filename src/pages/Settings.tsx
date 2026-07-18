import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Trash2, AlertTriangle, CheckCircle, Smartphone, Key, RefreshCw, Eye, EyeOff, ArrowLeft, MapPin, Plus, Edit, Home, Briefcase, Building } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendEmailVerification, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, updateDoc, collection, onSnapshot, addDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useNavigate } from '../components/common/RouteLink';
import { SavedAddress } from '../types';
import { PROVINCES } from '../constants';

export function Settings() {
  const { user, profile, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'en';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [reauthError, setReauthError] = useState('');

  // Address book states
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  
  // Inline Add/Edit Form state
  const [label, setLabel] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'addresses'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedAddress));
      setAddresses(list);
    });
    return () => unsub();
  }, [user]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!label || !fullName || !phone || !province || !city || !street) {
      setMessage({ text: 'Please fill in all address fields.', type: 'error' });
      return;
    }
    
    setLoading(true);
    try {
      const addressData = {
        label,
        fullName,
        phone,
        province,
        city,
        street,
        isDefault
      };
      
      const addressesRef = collection(db, 'users', user.uid, 'addresses');
      let targetId = editingAddress?.id;
      
      // If setting as default or if this is the very first address, it should be default
      const shouldBeDefault = isDefault || addresses.length === 0;
      addressData.isDefault = shouldBeDefault;
      
      if (shouldBeDefault) {
        const batch = writeBatch(db);
        // Clear other defaults
        addresses.forEach(addr => {
          if (addr.id !== targetId && addr.isDefault) {
            batch.update(doc(db, 'users', user.uid, 'addresses', addr.id), { isDefault: false });
          }
        });
        
        if (targetId) {
          batch.update(doc(db, 'users', user.uid, 'addresses', targetId), addressData);
        } else {
          const newDocRef = doc(collection(db, 'users', user.uid, 'addresses'));
          batch.set(newDocRef, addressData);
        }
        await batch.commit();
      } else {
        if (targetId) {
          await updateDoc(doc(db, 'users', user.uid, 'addresses', targetId), addressData);
        } else {
          await addDoc(addressesRef, addressData);
        }
      }
      
      resetAddressForm();
      setMessage({ text: 'Address saved successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save address', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetAddressForm = () => {
    setLabel('');
    setFullName('');
    setPhone('');
    setProvince('');
    setCity('');
    setStreet('');
    setIsDefault(false);
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleEditClick = (address: SavedAddress) => {
    setEditingAddress(address);
    setLabel(address.label);
    setFullName(address.fullName);
    setPhone(address.phone);
    setProvince(address.province);
    setCity(address.city);
    setStreet(address.street);
    setIsDefault(address.isDefault);
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
      setMessage({ text: 'Address deleted successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to delete address', type: 'error' });
    }
  };

  const handleSetDefault = async (address: SavedAddress) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      addresses.forEach(addr => {
        batch.update(doc(db, 'users', user.uid, 'addresses', addr.id), {
          isDefault: addr.id === address.id
        });
      });
      await batch.commit();
      setMessage({ text: 'Default address updated!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update default address', type: 'error' });
    }
  };

  const handleSendVerification = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await sendEmailVerification(user);
      setMessage({ text: 'Verification email sent! Check your inbox.', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Failed to send verification email.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !password) return;
    setLoading(true);
    setReauthError('');
    try {
      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);
      
      // Delete user profile and other data (simplified)
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Delete auth user
      await deleteUser(user);
      
      // Cleanup completed (though deleteUser might redirect or trigger sign out automatically)
      window.location.href = '/';
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        setReauthError('Incorrect password. Please try again.');
      } else {
        setReauthError(error.message || 'Failed to delete account.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-6 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      <div className="mb-12">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic mb-2">Account Settings</h1>
        <p className="text-gray-500 font-medium">Manage your security and account preferences.</p>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-8 p-6 rounded-3xl border flex items-center gap-4 shadow-sm",
            message.type === 'success' ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
          )}
        >
          {message.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <p className="font-black italic">{message.text}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-[35px] mx-auto mb-6 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-300" />
              )}
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">{profile.displayName || 'No Name'}</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">{profile.role}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <p className="text-xs font-bold text-gray-600 truncate">{user.email}</p>
              </div>

              {profile.role === 'seller' ? (
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-105 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer mt-2 shadow-xs"
                >
                  <Building className="w-4 h-4" />
                  <span>Gerir Lojas / Dashboard</span>
                </button>
              ) : profile.role !== 'admin' ? (
                <button 
                  onClick={() => navigate('/become-seller')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-md mt-2 hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Vender no Mercado / Sell</span>
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/admin')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-pink-50 hover:bg-pink-105 border border-pink-100 text-pink-600 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer mt-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>
              )}
            </div>
          </div>

          <button 
            onClick={() => signOut()}
            className="w-full py-5 bg-gray-900 text-white rounded-3xl font-black hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3"
          >
            Sign Out
          </button>
        </div>

        {/* Security Actions */}
        <div className="lg:col-span-8 space-y-6">
          {/* Email Verification */}
          {!user.emailVerified && user.providerData?.[0]?.providerId === 'password' && (
            <div className="bg-orange-50 p-8 rounded-[40px] border border-orange-100">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-white rounded-2xl text-orange-600 shadow-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">Verify Your Email</h3>
                  <p className="text-sm text-gray-600 font-medium">Protect your account and unlock all features by verifying your email address.</p>
                </div>
              </div>
              <button 
                onClick={handleSendVerification}
                disabled={loading}
                className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Send Verification Email
              </button>
            </div>
          )}

          {/* MFA / Security Info */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-gray-900 mb-6 italic">Security Shield</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-gray-100">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 underline decoration-blue-500/30">Two-Factor Authentication</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Highly Recommended</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-gray-100 text-[10px] font-black text-gray-500 uppercase rounded-full">Not Active</div>
              </div>

              <div className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-gray-100">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 underline decoration-purple-500/30">Active Sessions</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Currently 1 Device</p>
                  </div>
                </div>
                <button className="text-[10px] font-black text-purple-600 uppercase hover:underline">Manage</button>
              </div>
            </div>
          </div>

          {/* Address Book Section */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-gray-900 italic flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-blue-600" />
                  {language === 'pt' ? 'Caderno de Endereços' : 'Address Book'}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                  {language === 'pt' ? 'Gerencie seus endereços de entrega' : 'Manage your saved delivery locations'}
                </p>
              </div>
              {!showAddressForm && (
                <button
                  type="button"
                  onClick={() => {
                    resetAddressForm();
                    setShowAddressForm(true);
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-blue-100 select-none self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'pt' ? 'Adicionar Endereço' : 'Add Address'}
                </button>
              )}
            </div>

            {/* Address Form */}
            <AnimatePresence mode="wait">
              {showAddressForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleSaveAddress}
                  className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4 overflow-hidden text-left"
                >
                  <div className="flex items-center justify-between border-b border-gray-150 pb-2 mb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">
                      {editingAddress ? (language === 'pt' ? 'Editar Endereço' : 'Edit Address') : (language === 'pt' ? 'Novo Endereço de Entrega' : 'New Delivery Address')}
                    </h4>
                    <button
                      type="button"
                      onClick={resetAddressForm}
                      className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600"
                    >
                      {language === 'pt' ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Identificador (Ex: Casa, Escritório)' : 'Address Label (e.g. Home, Office)'}</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Home, Office, Warehouse"
                        className="w-full px-4 py-3 bg-white border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Nome Completo' : 'Receiver Full Name'}</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        className="w-full px-4 py-3 bg-white border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Telefone' : 'Contact Phone'}</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 841234567"
                        className="w-full px-4 py-3 bg-white border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Província' : 'Province'}</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-255 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                      >
                        <option value="">{language === 'pt' ? '-- Selecionar Província --' : '-- Select Province --'}</option>
                        {PROVINCES.map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Cidade' : 'City'}</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Maputo"
                        className="w-full px-4 py-3 bg-white border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">{language === 'pt' ? 'Rua / Bairro / Casa' : 'Street / Neighborhood / House'}</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Av. Julius Nyerere, 123"
                        className="w-full px-4 py-3 bg-white border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    <label htmlFor="isDefault" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                      {language === 'pt' ? 'Definir como endereço padrão' : 'Set as default delivery address'}
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {editingAddress ? (language === 'pt' ? 'Salvar Alterações' : 'Save Changes') : (language === 'pt' ? 'Salvar Endereço' : 'Save Address')}
                    </button>
                    <button
                      type="button"
                      onClick={resetAddressForm}
                      className="px-5 py-3 bg-white border border-gray-250 text-gray-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-150 transition-all"
                    >
                      {language === 'pt' ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List of Addresses */}
            {addresses.length === 0 ? (
              <div className="p-8 border border-dashed border-gray-200 rounded-[32px] text-center space-y-3">
                <MapPin className="w-10 h-10 text-gray-300 mx-auto animate-pulse" />
                <h4 className="text-sm font-black text-gray-800">
                  {language === 'pt' ? 'Nenhum endereço gravado' : 'No Saved Addresses'}
                </h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium leading-relaxed">
                  {language === 'pt' ? 'Ainda não adicionou nenhum endereço de entrega. Adicione um agora para acelerar as suas compras!' : 'Save a delivery address to accelerate order checkout and secure accurate delivery.'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="px-5 py-3 bg-blue-50 hover:bg-blue-105 text-blue-600 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  {language === 'pt' ? '+ Adicionar o Primeiro Endereço' : '+ Add your first address'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {addresses.map((address) => {
                  let IconComponent = MapPin;
                  const lblLower = address.label.toLowerCase();
                  if (lblLower.includes('home') || lblLower.includes('casa')) IconComponent = Home;
                  else if (lblLower.includes('office') || lblLower.includes('escritorio') || lblLower.includes('trabalho')) IconComponent = Briefcase;
                  else if (lblLower.includes('warehouse') || lblLower.includes('armazem')) IconComponent = Building;

                  return (
                    <div
                      key={address.id}
                      className={cn(
                        "p-6 rounded-[32px] border transition-all flex flex-col justify-between hover:shadow-md relative",
                        address.isDefault ? "border-blue-500 bg-blue-50/10 shadow-sm" : "border-gray-150 bg-white"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                            address.isDefault ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
                          )}>
                            <IconComponent className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                            {address.label}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditClick(address)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-all border border-transparent"
                              title="Edit address"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(address.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-all border border-transparent"
                              title="Delete address"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-black text-gray-900">{address.fullName}</p>
                          <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                            {address.phone}
                          </p>
                          <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">
                            {address.street}<br/>
                            {address.city}, {address.province}
                          </p>
                        </div>
                      </div>

                      {!address.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(address)}
                          className="mt-4 pt-3 border-t border-gray-100 w-full text-left text-[10px] font-black text-blue-600 uppercase hover:text-blue-700 tracking-widest hover:underline"
                        >
                          {language === 'pt' ? 'Definir como Padrão' : 'Set as Default'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50/50 p-8 rounded-[40px] border border-red-100 border-dashed">
            <h3 className="text-xl font-black text-red-600 mb-2 italic">Danger Zone</h3>
            <p className="text-sm text-red-500 font-medium mb-6">Irreversible actions that affect your account and data.</p>
            
            {!showDeleteConfirm ? (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 border-2 border-red-200 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="p-4 bg-white rounded-2xl border border-red-200 shadow-sm">
                  <p className="text-xs font-black text-red-600 mb-2 uppercase tracking-widest">Verify Password to Proceed</p>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your current password"
                      className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-red-500 outline-none pr-12 font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {reauthError && <p className="mt-2 text-[10px] font-bold text-red-600">{reauthError}</p>}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={loading || !password}
                    className="flex-2 py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                  >
                    Confirm Permanent Deletion
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
