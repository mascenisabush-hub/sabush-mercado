import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, signInWithPopup, getRedirectResult, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name?: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  ensureProfile: (u: User, name?: string) => Promise<void>;
  redirectError: string | null;
  clearRedirectError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const clearRedirectError = () => setRedirectError(null);

  // Helper to ensure profile exists
  const ensureProfile = async (u: User, name?: string) => {
    const docRef = doc(db, 'users', u.uid);
    const docSnap = await getDoc(docRef);
    const computedName = name || u.displayName || u.email?.split('@')[0] || 'User';

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        uid: u.uid,
        email: u.email,
        displayName: computedName,
        photoURL: u.photoURL || '',
        role: 'customer',
        isBanned: false,
        preferredLanguage: 'pt',
        createdAt: new Date().toISOString()
      });
    } else if (name) {
      // If the profile already exists but we have a custom display name (from registration), update database
      await updateDoc(docRef, {
        displayName: name
      });
    }
  };

  // Handle redirect result on page load/initialization
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          await ensureProfile(result.user);
        }
      })
      .catch((error) => {
        console.warn("Redirect check on page load:", error);
        // Do not propagate standard environment storage limit warnings as actual user sign-in errors.
        const isEnvWarning = error?.code === 'auth/web-storage-unsupported' || 
                             error?.code === 'auth/operation-not-supported-in-this-environment';
        if (!isEnvWarning) {
          setRedirectError("Ocorreu um erro ao iniciar sessão. Por favor, tente novamente.");
        }
      });
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Unsubscribe from previous profile snapshot listener if any
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      setUser(user);
      if (user) {
        setLoading(true);
        
        // Eagerly and asynchronously ensure profile exists to heal any missing profile states
        ensureProfile(user).catch((err) => {
          console.error("Eager profile ensure failed:", err);
        });
        
        // Use onSnapshot for the profile to handle real-time updates (especially during registration)
        profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            setLoading(false);
          } else {
            // Profile doesn't exist yet (e.g., registration in progress)
            // Immediately stop loading spinner so user isn't frozen; profile will stream once ensureProfile writes
            setProfile(null);
            setLoading(false);
          }
        }, (error) => {
          // If the user already logged out or is logging out, ignore errors from the profile listener
          if (!auth.currentUser || (error.code === 'permission-denied' && !auth.currentUser)) {
            return;
          }
          console.error("Profile listener error (gracefully handled):", error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    let idleTimer: any;
    
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (user) {
        // 15 minutes session timeout
        idleTimer = setTimeout(() => {
          console.warn("Session expired due to inactivity");
          auth.signOut();
        }, 15 * 60 * 1000);
      }
    };

    if (user) {
      window.addEventListener('mousemove', resetIdleTimer);
      window.addEventListener('keydown', resetIdleTimer);
      window.addEventListener('click', resetIdleTimer);
      resetIdleTimer();
    }

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
    };
  }, [user]);

  const signOut = async () => {
    await auth.signOut();
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const registerWithEmail = async (email: string, pass: string, name?: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await ensureProfile(result.user, name?.trim());
    try {
      await sendEmailVerification(result.user);
    } catch (e) {
      console.warn("Verification email failed to send", e);
    }
  };

  const signIn = async (email: string, pass: string) => {
    await loginWithEmail(email, pass);
  };

  const signUp = async (email: string, pass: string, name?: string) => {
    await registerWithEmail(email, pass, name);
  };

  const signInWithGoogle = async () => {
    try {
      setRedirectError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        await ensureProfile(result.user);
      }
    } catch (error: any) {
      console.warn("Popup sign-in failed or blocked by browser/iframe, falling back to redirect:", error);
      
      // If popup fails or is disabled (e.g. within some iframe sandbox policies), attempt standard redirect
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
      } catch (redirectErr: any) {
        console.error("Redirect trigger also failed:", redirectErr);
        setRedirectError("Ocorreu um erro ao iniciar sessão. Por favor, tente novamente.");
        throw new Error("Ocorreu um erro ao iniciar sessão. Por favor, tente novamente.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signIn, signUp, loginWithEmail, registerWithEmail, signInWithGoogle, ensureProfile, redirectError, clearRedirectError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
