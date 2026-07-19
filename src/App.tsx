/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider, useLocation } from './context/LocationContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';
import { RouterProvider, Route } from './components/common/RouteLink';
import { LanguageProvider } from './context/LanguageContext';
import { CompareProvider } from './context/CompareContext';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Home } from './pages/Home';
import { Marketplace } from './pages/Marketplace';
import { ShieldOff, LogOut } from 'lucide-react';
import { PWAManager } from './components/PWAManager';

const ProductDetails = React.lazy(() => import('./pages/ProductDetails').then(m => ({ default: m.ProductDetails })));
const StoreDetails = React.lazy(() => import('./pages/StoreDetails').then(m => ({ default: m.StoreDetails })));
const Cart = React.lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const OrderSuccess = React.lazy(() => import('./pages/OrderSuccess').then(m => ({ default: m.OrderSuccess })));
const RegisterSeller = React.lazy(() => import('./pages/RegisterSeller').then(m => ({ default: m.RegisterSeller })));
const SellerDashboard = React.lazy(() => import('./pages/SellerDashboard').then(m => ({ default: m.SellerDashboard })));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const MyOrders = React.lazy(() => import('./pages/MyOrders').then(m => ({ default: m.MyOrders })));
const Wishlist = React.lazy(() => import('./pages/Wishlist').then(m => ({ default: m.Wishlist })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Chat = React.lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));

function AppRoutes() {
  const { user, profile, loading, signOut } = useAuth();
  const { loading: locationLoading } = useLocation();

  if (loading || locationLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-900 font-black text-2xl animate-pulse">Mercado Sabush</p>
        <p className="text-gray-400 text-sm font-bold mt-2 uppercase tracking-widest">Iniciando o Marketplace...</p>
      </div>
    );
  }

  // Handle Banned State
  if (profile?.isBanned) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-red-50 rounded-[40px] flex items-center justify-center text-red-600 mb-8 border-4 border-red-100 shadow-xl shadow-red-50">
          <ShieldOff className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter italic">Your Account has been Banned</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-10 font-medium">
          We detected violations of our platform Terms and Conditions. If you believe this is a mistake, please contact our support team.
        </p>
        <button 
          onClick={() => signOut()}
          className="flex items-center gap-3 px-10 py-5 bg-gray-900 text-white rounded-3xl font-black hover:bg-black transition-all shadow-xl"
        >
          <LogOut className="w-6 h-6" /> Terminate Session
        </button>
      </div>
    );
  }

  return (
    <Layout>
      <Suspense fallback={
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-900 font-black text-2xl animate-pulse">Mercado Sabush</p>
          <p className="text-gray-400 text-sm font-bold mt-2 uppercase tracking-widest">Iniciando o Marketplace...</p>
        </div>
      }>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/marketplace">
          <Marketplace />
        </Route>
        <Route path="/product/:id">
          {/* Simplified pattern matching handles :id via currentPath check */}
          <ProductDetails id={window.location.pathname.split('/').pop() || ''} />
        </Route>
        <Route path="/store/:id">
          {/* Simplified pattern matching handles :id via currentPath check */}
          <StoreDetails id={window.location.pathname.split('/').pop() || ''} />
        </Route>
        <Route path="/cart">
          <Cart />
        </Route>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/order-success">
          <OrderSuccess />
        </Route>
        <Route path="/sell">
          <RegisterSeller />
        </Route>
        <Route path="/register-seller">
          <RegisterSeller />
        </Route>
        <Route path="/messages">
          {user ? <Chat /> : <Login redirect="/chat" />}
        </Route>
        <Route path="/chat">
          {user ? <Chat /> : <Login redirect="/chat" />}
        </Route>
        <Route path="/orders">
          {user ? <MyOrders /> : <Login redirect="/orders" />}
        </Route>
        <Route path="/wishlist">
          {user ? <Wishlist /> : <Login redirect="/wishlist" />}
        </Route>
        <Route path="/profile">
          {user ? <Settings /> : <Login redirect="/profile" />}
        </Route>
        <Route path="/settings">
          {user ? <Settings /> : <Login redirect="/settings" />}
        </Route>
        <Route path="/dashboard">
          {user ? <SellerDashboard /> : <Login redirect="/dashboard" />}
        </Route>
        <Route path="/become-seller">
          {user ? <RegisterSeller /> : <Login redirect="/become-seller" />}
        </Route>
        <Route path="/admin">
          {profile?.role === 'admin' ? <AdminPanel /> : (user ? <Home /> : <Login redirect="/admin" />)}
        </Route>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LocationProvider>
          <NotificationProvider>
            <ChatProvider>
              <CartProvider>
                <CompareProvider>
                  <RouterProvider>
                    <PWAManager />
                    <ErrorBoundary>
                      <AppRoutes />
                    </ErrorBoundary>
                  </RouterProvider>
                </CompareProvider>
              </CartProvider>
            </ChatProvider>
          </NotificationProvider>
        </LocationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
