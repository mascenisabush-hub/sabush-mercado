import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Chrome, ShieldCheck, Shield, Eye, EyeOff, Loader2, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, RouterContext } from '../components/common/RouteLink';
import { signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { parseFirestoreError } from '../lib/firebaseErrors';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useContext } from 'react';
import { cn } from '../lib/utils';

export function Login({ redirect }: { redirect?: string }) {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [strength, setStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);
  
  const { loginWithEmail, registerWithEmail, signInWithGoogle, user, loading: authLoading, redirectError, clearRedirectError } = useAuth();
  const navigate = useNavigate();
  const { path } = useContext(RouterContext);
  const location = window.location.search;
  
  const redirectPath = redirect || new URLSearchParams(location).get('redirect') || '/';

  const [userType, setUserType] = useState<'client' | 'seller'>(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirect') || '';
    if (redirectParam.includes('dashboard') || redirectParam.includes('seller') || redirectParam.includes('admin') || redirectParam.includes('profile') || redirectParam.includes('sell')) {
      return 'seller';
    }
    return 'client';
  });

  const [isInIframe, setIsInIframe] = useState(false);

  // Auto-redirect if user gets authenticated (including after Google Redirect)
  useEffect(() => {
    if (user && !authLoading) {
      navigate(redirectPath);
    }
  }, [user, authLoading, navigate, redirectPath]);

  // Handle errors surfaced from redirect authentication on mount/page load
  useEffect(() => {
    if (redirectError) {
      setError(redirectError);
      clearRedirectError();
    }
  }, [redirectError, clearRedirectError]);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'register') setIsRegister(true);
    else if (mode === 'login') setIsRegister(false);
  }, [path, location]);

  useEffect(() => {
    if (isRegister) {
      validatePassword(password);
    } else {
      setStrength(0);
      setPasswordFeedback([]);
    }
  }, [password, isRegister]);

  const validatePassword = (pass: string) => {
    let score = 0;
    const feedback: string[] = [];
    if (pass.length >= 8) score++;
    else feedback.push('At least 8 characters');
    if (/[A-Z]/.test(pass)) score++;
    else feedback.push('One uppercase letter');
    if (/[0-9]/.test(pass)) score++;
    else feedback.push('One number');
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    else feedback.push('One special character');
    setStrength(score);
    setPasswordFeedback(feedback);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Por favor, introduza o seu endereço de e-mail primeiro.');
      return;
    }
    setResetLoading(true);
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage('E-mail de reposição de palavra-passe enviado! Verifique a sua caixa de entrada.');
    } catch (err: any) {
      setError(parseFirestoreError(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();
    
    try {
      if (isRegister) {
        if (strength < 2) {
          setError('Por favor, escolha uma palavra-passe mais forte.');
          setLoading(false);
          return;
        }
        await registerWithEmail(trimmedEmail, password, trimmedDisplayName);
      } else {
        await loginWithEmail(trimmedEmail, password);
      }
      // Rely on the useEffect to redirect once auth state and profile snapshot are both fully loaded.
    } catch (err: any) {
      setError(parseFirestoreError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 md:p-12 relative overflow-hidden border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Mercado Sabush</div>
          </div>
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-3xl italic mb-6 shadow-lg shadow-blue-100">S</div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            {userType === 'client' 
              ? 'Comprar no Sabush' 
              : (isRegister ? t('auth.create_account') : t('auth.welcome_back'))}
          </h1>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            {userType === 'client' 
              ? 'Navegue e compre livremente sem criar conta!' 
              : 'Gerencie sua loja e veja seus pedidos recebidos'}
          </p>
        </div>

        {/* Dynamic Segmented Control to separate Shoppers and Store Owners */}
        <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200/50 mb-8 font-sans">
          <button
            type="button"
            onClick={() => setUserType('client')}
            className={cn(
              "flex-1 py-3 px-2 rounded-xl transition-all font-black uppercase tracking-wider text-center text-[10px] flex items-center justify-center gap-1.5 cursor-pointer",
              userType === 'client' ? "bg-white text-blue-600 shadow-sm border border-gray-200/10" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <UserIcon className="w-4 h-4" />
            <span>Comprar (Cliente)</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType('seller')}
            className={cn(
              "flex-1 py-3 px-2 rounded-xl transition-all font-black uppercase tracking-wider text-center text-[10px] flex items-center justify-center gap-1.5 cursor-pointer",
              userType === 'seller' ? "bg-white text-blue-600 shadow-sm border border-gray-200/10" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Vender (Dono/Seller)</span>
          </button>
        </div>

        {isInIframe && userType === 'seller' && (
          <div className="mb-6 p-5 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border border-blue-100 rounded-3xl text-xs text-blue-700 font-medium relative overflow-hidden shadow-sm">
            <p className="font-extrabold uppercase tracking-wider text-[10px] text-blue-800 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
              {t('auth.iframe_tip_title')}
            </p>
            <p className="mb-3 leading-relaxed text-blue-600 font-medium">
              {t('auth.iframe_tip_desc')}
            </p>
            <a 
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-md shadow-blue-100"
            >
              {t('auth.open_new_tab')}
            </a>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold animate-shake flex flex-col gap-2">
            <div>{error}</div>
            
            {/* Special Troubleshooting Guide for auth/operation-not-allowed Error */}
            {(error.includes('permitida') || error.includes('not-allowed') || error.includes('operac')) && (
              <div className="mt-3 pt-3 border-t border-red-200 text-[11px] text-slate-700 font-medium normal-case leading-relaxed space-y-2.5">
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

            {isInIframe && (error.includes('Ligação') || error.includes('Google') || error.includes('network') || error.includes('popup')) && (
              <div className="pt-2 mt-1 border-t border-red-100 text-[11px] text-red-500 font-medium normal-case leading-relaxed">
                Este erro ocorre porque o navegador bloqueia cookies/popups de terceiros dentro deste painel (iframe). Abra a aplicação numa janela principal do navegador para resolver instantaneamente.
                <div className="mt-2">
                  <a 
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-red-600 hover:bg-red-700 text-white font-black px-3.5 py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all shadow-md shadow-red-100"
                  >
                    Abrir no Navegador & Resolver
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl text-xs font-bold">
            {message}
          </div>
        )}

        {userType === 'client' ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100 p-6 rounded-3xl text-sm space-y-4">
              <h4 className="font-extrabold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-2">
                🛍️ Como Funciona para Compradores:
              </h4>
              <ul className="space-y-3.5 text-xs text-gray-600 font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold mt-0.5">✔</span>
                  <span><strong>Navegação 100% Livre:</strong> Pode pesquisar artigos, ver stock real das lojas e comparar preços sem precisar de passwords ou logins.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold mt-0.5">✔</span>
                  <span><strong>Detalhes de Encomenda:</strong> Ao finalizar as compras no carrinho, basta inserir os seus dados de contacto (Nome, Telefone e WhatsApp de entrega). É rápido e sem burocracia.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold mt-0.5">✔</span>
                  <span><strong>Entrega Direta:</strong> Os donos das lojas recebem o aviso em tempo real e entram em contacto direto via WhatsApp para agendar a entrega!</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-center text-sm uppercase tracking-wider transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 hover:scale-[1.01] cursor-pointer"
            >
              Ir para o Mercado 🚀
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-150"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase text-gray-400 bg-white px-2 tracking-widest">Seja Vendedor do Sabush</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setUserType('seller');
                setIsRegister(false);
              }}
              className="w-full py-4 bg-white border border-gray-200 text-gray-700 text-center rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all hover:border-gray-300 cursor-pointer"
            >
              Prefere Iniciar Sessão para Gerir Loja / Vender?
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">{t('auth.name', 'Full Name')}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                      type="text" 
                      required
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Seu Nome Completo"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="seunome@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {isRegister && password.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 px-2 space-y-3"
                  >
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div 
                          key={i}
                          className={cn(
                            "flex-1 rounded-full transition-all duration-500",
                            strength >= i 
                              ? (strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-orange-400" : strength <= 3 ? "bg-yellow-400" : "bg-green-400")
                              : "bg-gray-100"
                          )}
                        />
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {strength === 4 ? (
                        <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest">
                           <ShieldCheck className="w-3 h-3" /> Secure Password
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                           <Shield className="w-3 h-3" /> {strength <= 1 ? 'Very Weak' : strength <= 2 ? 'Weak' : 'Medium'}
                        </div>
                      )}
                      
                      {passwordFeedback.length > 0 && (
                        <div className="flex gap-1">
                          {passwordFeedback.slice(0, 2).map((msg, i) => (
                            <span key={i} className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                              {msg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {!isRegister && (
                 <div className="text-right">
                    <button 
                      type="button" 
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {resetLoading ? 'Sending...' : t('auth.forgot_password')}
                    </button>
                 </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRegister ? t('auth.create_account') : t('nav.login'))}
                {!loading && <ArrowRight className="w-6 h-6" />}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-gray-400 bg-white px-4">Or continue with</div>
            </div>

            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm font-bold text-sm cursor-pointer mb-6"
            >
              <Chrome className="w-5 h-5 text-red-500" /> Google
            </button>

            <p className="text-center text-sm text-gray-500 font-medium">
              {isRegister ? t('auth.have_account') : t('auth.no_account')} <br />
              <button 
                type="button"
                onClick={() => setIsRegister(!isRegister)} 
                className={cn(
                  "font-black hover:underline mt-2 p-2 transition-colors cursor-pointer",
                  isRegister ? "text-blue-600" : "text-gray-900"
                )}
              >
                {isRegister ? t('nav.login') : t('auth.create_account')}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
