import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Notification as DbNotification } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

interface NotificationContextType {
  notifications: DbNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (
    userId: string, 
    title: string, 
    message: string, 
    type: 'order' | 'chat' | 'mpesa' | 'emola' | 'bank' | 'price_drop' | 'withdrawal_approved' | 'withdrawal_rejected' | 'earning_received',
    extra?: { productId?: string; oldPrice?: number; newPrice?: number; percentSaved?: number }
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DbNotification[];
      
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);

      // Trigger browser notification for the newest one if it's unread and just arrived
      const latest = newNotifications[0];
      if (latest && !latest.read && typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted') {
        const lastNotifTime = localStorage.getItem('lastNotifTime');
        if (!lastNotifTime || new Date(latest.createdAt).getTime() > parseInt(lastNotifTime)) {
             new window.Notification(latest.title, {
                body: latest.message,
                icon: '/favicon.ico' // Default icon
             });
             localStorage.setItem('lastNotifTime', new Date(latest.createdAt).getTime().toString());
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      ));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const sendNotification = async (
    userId: string, 
    title: string, 
    message: string, 
    type: 'order' | 'chat' | 'mpesa' | 'emola' | 'bank' | 'price_drop' | 'withdrawal_approved' | 'withdrawal_rejected' | 'earning_received',
    extra?: { productId?: string; oldPrice?: number; newPrice?: number; percentSaved?: number }
  ) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
        ...(extra || {})
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
