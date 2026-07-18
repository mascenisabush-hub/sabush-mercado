import React, { useState } from 'react';
import { Store, MapPin, Phone, MessageSquare, Truck, CheckCircle, ArrowRight, Briefcase, Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff, Mail, Lock, User as UserIcon, Clock } from 'lucide-react';
import { useNavigate } from '../components/common/RouteLink';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, updateDoc, getDocs, collection, query, where, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { CATEGORIES, PROVINCES } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useTranslation } from 'react-i18next';
import { TermsModal } from '../components/modals/TermsModal';

export function RegisterSeller() {
  const { t } = useTranslation();
  const { user, profile, signInWithGoogle, registerWithEmail, loginWithEmail } = useAuth();
  const { location: appLocation, requestLocation, selectedCountry } = useAppLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Onboarding gate states for unregistered visitors
  const [isRegisteringEmail, setIsRegisteringEmail] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailName, setEmailName] = useState('');

  // Form states
  const [fullName, setFullName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [offeringType, setOfferingType] = useState<'products' | 'services' | 'both'>('products');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [nuit, setNuit] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [deliveryOptions, setDeliveryOptions] = useState<'pickup' | 'delivery' | 'both'>('both');
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number | null, longitude: number | null }>({
    latitude: null,
    longitude: null
  });

  // Sync profile/user info upon successful authentication
  React.useEffect(() => {
    if (user) {
      if (!fullName && (profile?.displayName || user.displayName)) {
        setFullName(profile?.displayName || user.displayName || '');
      }
      if (!email && user.email) {
        setEmail(user.email);
      }
    }
  }, [user, profile]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Falha ao autenticar com o Google. / Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegisteringEmail) {
        if (!emailName.trim()) {
          setError('Por favor insira o seu Nome Completo. / Please enter your Full Name.');
          setLoading(false);
          return;
        }
        await registerWithEmail(emailAddress, emailPassword, emailName);
      } else {
        await loginWithEmail(emailAddress, emailPassword);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Falha na autenticação. Por favor verifique os dados. / Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      await requestLocation();
      if (appLocation) {
        setGpsLocation({
          latitude: appLocation.latitude,
          longitude: appLocation.longitude
        });
        setLocation(prev => prev || `Lat: ${appLocation.latitude.toFixed(4)}, Lng: ${appLocation.longitude.toFixed(4)}`);
      }
    } catch (err) {
      console.error("Location error:", err);
    } finally {
      setLocating(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      setError('Por favor selecione pelo menos uma categoria de produto. / Please select at least one product category.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let activeUserId = user?.uid || null;

      // 1. Handle Registration if visitor is not logged in
      if (!activeUserId) {
        if (!email || !password || !fullName) {
          throw new Error('Nome Completo, Email e Palavra-passe são obrigatórios para registar. / Full Name, Email and Password are required.');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        activeUserId = userCredential.user.uid;

        // Create User Profile
        const userDocRef = doc(db, 'users', activeUserId);
        await setDoc(userDocRef, {
          uid: activeUserId,
          email: email.toLowerCase(),
          displayName: fullName,
          role: 'seller',
          isBanned: false,
          country: selectedCountry.code,
          currency: selectedCountry.currency,
          preferredLanguage: 'pt',
          phoneNumber: phone,
          createdAt: new Date().toISOString()
        });
      } else {
        // Logged-in user: mark role as seller
        await updateDoc(doc(db, 'users', activeUserId), {
          role: 'seller',
          country: selectedCountry.code,
          currency: selectedCountry.currency,
          phoneNumber: phone || profile?.phoneNumber || ''
        });
      }

      // 2. Create Store document
      const storeId = `store_${activeUserId}`;
      await setDoc(doc(db, 'stores', storeId), {
        ownerId: activeUserId,
        businessName,
        offeringType, // products, services, or both
        category: selectedCategories.join(', '), // Comma separated for legacy rendering
        categories: selectedCategories, // Modern list
        description,
        location,
        province,
        district,
        neighborhood,
        nuit,
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        country: selectedCountry.code,
        currency: selectedCountry.currency,
        whatsappNumber: whatsapp || phone,
        deliveryOptions,
        rating: 0,
        reviewCount: 0,
        isVerified: false,
        status: 'pending', // Pending Admin approval
        createdAt: new Date().toISOString()
      });

      // 3. Notify Admin(s)
      try {
        const adminsQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminsSnapshot = await getDocs(adminsQuery);
        const adminUids: string[] = [];
        
        adminsSnapshot.forEach(docSnap => {
          adminUids.push(docSnap.id);
        });

        // Always fallback to sabushmike email if offline/not listed
        if (adminUids.length === 0) {
          // Trigger a global request log or system notice
          await addDoc(collection(db, 'notifications'), {
            userId: 'system_admin_all',
            title: 'Nova Solicitação de Vendedor / New Seller Store Request',
            message: `A loja "${businessName}" registou-se e aguarda aprovação de administrador.`,
            type: 'order',
            read: false,
            createdAt: new Date().toISOString()
          });
        } else {
          // Write notifications for each Admin
          await Promise.all(adminUids.map(uid => 
            addDoc(collection(db, 'notifications'), {
              userId: uid,
              title: 'Nova Solicitação de Vendedor / New Seller Store Request',
              message: `A loja "${businessName}" (${fullName}) registou-se e aguarda aprovação.`,
              type: 'order',
              read: false,
              createdAt: new Date().toISOString()
            })
          ));
        }
      } catch (notifyErr) {
        console.warn("Notification trigger warning:", notifyErr);
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao registar a loja. Por favor tente novamente. / Failed to register store. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Screening Screen for Successful Submission
  if (isSubmitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-[40px] border border-gray-100 shadow-xl flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-yellow-50 text-yellow-600 rounded-[35px] flex items-center justify-center mb-8 border border-yellow-100 shadow-md animate-pulse">
            <Clock className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight italic mb-3">
            Loja em Análise!
          </h2>
          <h3 className="text-xl font-bold text-gray-700 tracking-tight mb-4">
            Shop Under Review
          </h3>
          <p className="text-gray-500 font-medium mb-2 text-base leading-relaxed">
            A sua loja está sob análise. Notificaremos em breve assim que o administrador aprovar o seu registo.
          </p>
          <p className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-8">
            Your shop is under review. We'll notify you soon. Check back shortly.
          </p>
          
          <div className="w-full space-y-3">
            <button 
              onClick={() => navigate('/marketplace')} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Go to Marketplace
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-sm uppercase tracking-widest rounded-2xl transition-all"
            >
              Back Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <button 
          onClick={() => navigate('/marketplace')} 
          className="mb-8 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
        >
           <ArrowLeft className="w-5 h-5" /> {t('common.back', 'Back')}
        </button>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[30px] mx-auto flex items-center justify-center mb-6 shadow-md border hover:scale-105 transition-transform">
             <Store className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight uppercase">Junte-se como Vendedor</h1>
          <h2 className="text-xs font-black text-blue-600 uppercase tracking-widest">Join as a Seller</h2>
          <p className="text-gray-500 text-xs mt-3 leading-relaxed">
            Crie a sua loja no Mercado Sabush de forma simples e rápida. Por favor, associe a sua conta para começar.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex flex-col gap-2">
            <div className="text-center">{error}</div>
            
            {/* Special Troubleshooting Guide for auth/operation-not-allowed Error */}
            {(error.includes('permitida') || error.includes('not-allowed') || error.includes('operac')) && (
              <div className="mt-3 pt-3 border-t border-red-200 text-[11px] text-slate-700 font-medium normal-case text-left leading-relaxed space-y-2.5">
                <div className="p-3.5 bg-white border border-red-100 rounded-xl space-y-2 text-slate-600 shadow-sm">
                  <p className="font-extrabold text-red-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    ℹ️ RESOLUÇÃO DE AUTENTICAÇÃO / AUTH RESOLUTION
                  </p>
                  <p className="leading-relaxed">
                    Este erro acontece porque este painel está a usar o projeto Firebase predefinido do espaço de trabalho (<code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono">western-myth-vp2jd</code>), o qual não tem o fornecedor de <strong>E-mail/Palavra-passe</strong> ativo.
                  </p>
                  
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    <p className="font-bold text-slate-800">Se pretender usar o seu projeto próprio (<code className="text-blue-600">mercado-sabush</code>):</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Abra o ficheiro <code className="bg-slate-50 px-1 py-0.5 rounded font-mono text-slate-600">/firebase-applet-config.json</code> no painel de código (Code Editor).</li>
                      <li>Substitua os dados de configuração pelas propriedades correspondentes da sua consola do Firebase (do seu projeto <strong>mercado-sabush</strong>).</li>
                      <li>Guarde o ficheiro para ligar este painel diretamente ao seu banco de dados correto!</li>
                    </ol>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    <p className="font-bold text-slate-800">Alternativamente, para ativar no projeto atual do espaço de trabalho:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Aceda à consola do Firebase ligada ao seu e-mail do workspace.</li>
                      <li>Encontre o projeto <code className="font-mono text-slate-600">western-myth-vp2jd</code>.</li>
                      <li>Vá a <strong>Authentication</strong> &rarr; <strong>Sign-in method</strong> &rarr; <strong>Add new provider</strong> &rarr; Ative <strong>E-mail/Password</strong>.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
          <div className="text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Recomendado / Recommended</span>
            {/* Google Sign In Call to Action */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3.5 py-4 px-6 bg-white border border-gray-200 text-gray-900 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all focus:ring-2 focus:ring-blue-500 font-black text-sm cursor-pointer shadow-sm"
              type="button"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.6 15.02 1 12 1 7.22 1 3.16 3.74 1.22 7.74l3.85 3c.92-2.74 3.49-4.7 6.93-4.7z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.54h6.46c-.28 1.44-1.1 2.66-2.33 3.47l3.62 2.81c2.12-1.95 3.34-4.83 3.34-8.48z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.07 14.74c-.24-.71-.37-1.47-.37-2.74s.13-2.03.37-2.74l-3.85-3C.44 7.7 0 9.77 0 12s.44 4.3 1.22 5.74l3.85-3z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.62-2.81c-1.1.74-2.51 1.18-4.34 1.18-3.44 0-6.01-1.96-6.93-4.7l-3.85 3C3.16 20.26 7.22 23 12 23z"
                />
              </svg>
              <span>Continuar com o Google</span>
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-gray-400 font-black text-[9px] uppercase tracking-widest font-mono">Ou use E-mail</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          {/* Tab Selection */}
          <div className="flex p-1 bg-gray-50 rounded-xl">
            <button
              onClick={() => { setIsRegisteringEmail(false); setError(''); }}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer",
                !isRegisteringEmail ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-900"
              )}
              type="button"
            >
              Entrar
            </button>
            <button
              onClick={() => { setIsRegisteringEmail(true); setError(''); }}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer",
                isRegisteringEmail ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-900"
              )}
              type="button"
            >
              Registar
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegisteringEmail && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
                    placeholder="Nome Completo / Full Name"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Endereço de Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
                  placeholder="exemplo@gmail.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Palavra-passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
                  placeholder="••••••••"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isRegisteringEmail ? 'Confirmar Registo / Sign Up' : 'Entrar / Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
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
         <ArrowLeft className="w-5 h-5" /> {t('common.back', 'Back')}
      </button>

      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-6">
           <Store className="w-10 h-10" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4 tracking-tight uppercase">Junte-se como Vendedor</h1>
        <h2 className="text-lg sm:text-xl font-bold text-blue-600 mb-2 uppercase tracking-wide">Register as a Seller</h2>
        <p className="text-gray-500 text-base max-w-xl mx-auto mt-2">
          Junte-se a milhares de negócios em Moçambique e comece a vender os seus produtos online hoje mesmo. / Join businesses across Mozambique.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex flex-col gap-2">
          <div className="text-center">{error}</div>
          
          {/* Special Troubleshooting Guide for auth/operation-not-allowed Error */}
          {(error.includes('permitida') || error.includes('not-allowed') || error.includes('operac')) && (
            <div className="mt-3 pt-3 border-t border-red-200 text-[11px] text-slate-700 font-medium normal-case text-left leading-relaxed space-y-2.5">
              <div className="p-3.5 bg-white border border-red-100 rounded-xl space-y-2 text-slate-600 shadow-sm">
                <p className="font-extrabold text-red-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  ℹ️ RESOLUÇÃO DE AUTENTICAÇÃO / AUTH RESOLUTION
                </p>
                <p className="leading-relaxed">
                  Este erro acontece porque este painel está a usar o projeto Firebase predefinido do espaço de trabalho (<code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono">western-myth-vp2jd</code>), o qual não tem o fornecedor de <strong>E-mail/Palavra-passe</strong> ativo.
                </p>
                
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <p className="font-bold text-slate-800">Se pretender usar o seu projeto próprio (<code className="text-blue-600">mercado-sabush</code>):</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Abra o ficheiro <code className="bg-slate-50 px-1 py-0.5 rounded font-mono text-slate-600">/firebase-applet-config.json</code> no painel de código (Code Editor).</li>
                    <li>Substitua os dados de configuração pelas propriedades correspondentes da sua consola do Firebase (do seu projeto <strong>mercado-sabush</strong>).</li>
                    <li>Guarde o ficheiro para ligar este painel diretamente ao seu banco de dados correto!</li>
                  </ol>
                </div>

                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <p className="font-bold text-slate-800">Alternativamente, para ativar no projeto atual do espaço de trabalho:</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Aceda à consola do Firebase ligada ao seu e-mail do workspace.</li>
                    <li>Encontre o projeto <code className="font-mono text-slate-600">western-myth-vp2jd</code>.</li>
                    <li>Vá a <strong>Authentication</strong> &rarr; <strong>Sign-in method</strong> &rarr; <strong>Add new provider</strong> &rarr; Ative <strong>E-mail/Password</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-12 rounded-[40px] border border-gray-100 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Auth/Business Basic Info */}
        <div className="space-y-6">
          <h3 className="font-black text-gray-900 text-lg flex items-center gap-2 mb-4 uppercase">
            <UserIcon className="w-5 h-5 text-blue-600" /> 1. Credenciais / Persona
          </h3>

          {!user ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome Completo * / Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Ex: João Tembe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Email / Correio Eletrónico *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Ex: joao@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Palavra-passe * / Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 font-bold rounded-2xl flex items-center justify-center shrink-0">
                {profile?.displayName ? profile.displayName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Sessão Ativa / Active Account</p>
                <p className="text-gray-900 font-bold text-sm leading-tight">{profile?.displayName || user.email}</p>
                <p className="text-gray-500 text-xs truncate max-w-[200px]">{user.email}</p>
              </div>
            </div>
          )}

          <hr className="border-gray-100" />

          <h3 className="font-black text-gray-900 text-lg flex items-center gap-2 uppercase">
            <Briefcase className="w-5 h-5 text-blue-600" /> 2. Detalhes do Negócio / Shop Info
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome da Loja * / Shop Name</label>
            <div className="relative">
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: Tech Hub Maputo"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">NUIT (Número de Contribuinte Moçambicano)*</label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: 123456789"
                value={nuit}
                onChange={(e) => setNuit(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 font-bold">
              O que a sua Empresa oferece? / What does your business offer? *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOfferingType('products');
                  setSelectedCategories([]);
                }}
                className={cn(
                  "p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]",
                  offeringType === 'products'
                    ? "border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/50 text-gray-600"
                )}
              >
                <Store className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-wider block text-center leading-tight">Produtos<br/><span className="text-[8px] font-medium tracking-normal text-gray-400 block mt-0.5">Products</span></span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setOfferingType('services');
                  setSelectedCategories([]);
                }}
                className={cn(
                  "p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]",
                  offeringType === 'services'
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/50 text-gray-600"
                )}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-wider block text-center leading-tight">Serviços<br/><span className="text-[8px] font-medium tracking-normal text-gray-400 block mt-0.5">Services</span></span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setOfferingType('both');
                  setSelectedCategories([]);
                }}
                className={cn(
                  "p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]",
                  offeringType === 'both'
                    ? "border-purple-600 bg-purple-50/70 text-purple-700 shadow-sm"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/50 text-gray-600"
                )}
              >
                <div className="flex gap-1 items-center justify-center">
                  <Store className="w-4 h-4 text-blue-500" />
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider block text-center leading-tight">Ambos<br/><span className="text-[8px] font-medium tracking-normal text-gray-400 block mt-0.5">Both</span></span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 font-bold flex items-center justify-between">
              Categorias Disponíveis * / Available Categories
              <span className="text-[8px] tracking-normal italic text-blue-500 font-medium">Selecione Múltiplas / Multi-select</span>
            </label>

            {(offeringType === 'products' || offeringType === 'both') && (
              <div className="space-y-2">
                {offeringType === 'both' && (
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block ml-2">
                    📦 Categorias de Produtos / Product Categories
                  </span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter(cat => cat.type === 'product' || !cat.type).map(cat => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between gap-1 cursor-pointer",
                          isSelected 
                            ? "border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm" 
                            : "border-gray-100 hover:border-gray-200 bg-gray-50/50 text-gray-600"
                        )}
                      >
                        <span className="truncate">{cat.translationKey ? t(cat.translationKey) : cat.name}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(offeringType === 'services' || offeringType === 'both') && (
              <div className="space-y-2 pt-2">
                {offeringType === 'both' && (
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block ml-2">
                    🛠️ Categorias de Serviços / Service Categories
                  </span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter(cat => cat.type === 'service').map(cat => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between gap-1 cursor-pointer",
                          isSelected 
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm" 
                            : "border-gray-100 hover:border-gray-200 bg-gray-50/50 text-gray-600"
                        )}
                      >
                        <span className="truncate">{cat.translationKey ? t(cat.translationKey) : cat.name}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Descrição da Loja / Description</label>
            <textarea 
              className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] text-sm"
              placeholder="Fale um pouco sobre o seu negócio..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
        </div>

        {/* Right Side: Contact, Logistics & Submit */}
        <div className="space-y-6">
          <h3 className="font-black text-gray-900 text-lg flex items-center gap-2 mb-4 uppercase">
            <MapPin className="w-5 h-5 text-blue-600" /> 3. Contacto e Logística
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cidade, Bairro / Shop Address *</label>
              <button 
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                {gpsLocation.latitude ? 'GPS Capturado / Captured' : 'Usar Localização Atual'}
              </button>
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: Maputo, Bairro Central"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            {gpsLocation.latitude && (
               <p className="text-[10px] font-bold text-green-600 ml-4 flex items-center gap-1">
                 <CheckCircle className="w-3 h-3" /> Coordenadas GPS registadas para cálculo rotas
               </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Província *</label>
            <select 
              required
              className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">Selecione a Província / State</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Distrito *</label>
              <input 
                type="text" 
                required
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: KaMpfumo"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Bairro *</label>
              <input 
                type="text" 
                required
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: Polana"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contacto de Telefone *</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="tel" 
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: 840000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contacto WhatsApp (Opcional)</label>
            <div className="relative">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="tel" 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Ex: 840000000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Opções de Entrega / Dispatch Options</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pickup', label: 'Levantamento', icon: Store },
                { id: 'delivery', label: 'Envio', icon: Truck },
                { id: 'both', label: 'Ambos / Both', icon: CheckCircle }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeliveryOptions(opt.id as any)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2",
                    deliveryOptions === opt.id ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-400 hover:border-gray-200"
                  )}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="text-[9px] font-bold uppercase text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6">
             <button 
               type="submit" 
               disabled={loading}
               className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-55"
             >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" /> Registando Loja...
                  </>
                ) : (
                  <>
                    Criar Minha Loja / Launch Store <ArrowRight className="w-5 h-5" />
                  </>
                )}
             </button>
             <p className="text-center mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
               Ao Criar uma loja, concorda com os{' '}
               <button
                 type="button"
                 onClick={() => setShowTermsModal(true)}
                 className="text-blue-600 hover:underline hover:text-blue-700 font-black cursor-pointer transition-colors"
               >
                 termos e condições
               </button>{' '}
               do Mercado Sabush
             </p>
          </div>
        </div>
      </form>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}
