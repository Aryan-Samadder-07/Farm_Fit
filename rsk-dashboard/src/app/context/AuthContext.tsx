'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface UserProfile {
  name: string;
  role: 'FARMER' | 'PROFESSIONAL';
  village_name?: string;
  email?: string;
  phone_number?: string;
  designation?: 'EXPERT' | 'ADMIN';
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  loginFarmer: (name: string, villageName: string, phoneNumber: string, otp: string) => Promise<boolean>;
  loginFarmerFirebase: (name: string, villageName: string, idToken: string) => Promise<boolean>;
  signupProfessional: (payload: any) => Promise<boolean>;
  loginProfessional: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string, rolePreference: string, villageName?: string) => Promise<boolean>;
  signupWithGoogle: (payload: any) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load session from localStorage on startup
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('kisan_auth_token');
      const storedUser = localStorage.getItem('kisan_auth_user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Route Protection Guard
  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';
    
    // Redirect unauthenticated users to /login
    if (!token && !isAuthPage) {
      router.push('/login');
      return;
    }

    // Redirect logged-in users away from auth pages
    if (token && isAuthPage) {
      const designation = user?.designation?.toUpperCase() || '';
      if (designation === 'ADMIN') {
        router.push('/');
      } else if (user?.role === 'FARMER') {
        router.push('/diagnose');
      } else if (designation === 'VILLAGE CHIEF') {
        router.push('/analytics');
      } else if (designation === 'RSK EXPERT') {
        router.push('/');
      } else if (designation === 'MANDI HEAD') {
        router.push('/analytics');
      } else {
        router.push('/diagnose');
      }
      return;
    }

    // Role-based restrictions
    if (token && user) {
      const designation = user.designation?.toUpperCase() || '';
      
      if (designation === 'ADMIN') {
        // Admin has universal access
        return;
      }
      
      if (user.role === 'FARMER') {
        const allowed = ['/diagnose', '/agronomy', '/knowledge', '/gis'];
        if (!allowed.includes(pathname)) {
          router.push('/diagnose');
        }
      } else if (user.role === 'PROFESSIONAL') {
        if (designation === 'VILLAGE CHIEF') {
          const allowed = ['/analytics', '/analytics/logging', '/gis'];
          if (!allowed.includes(pathname)) {
            router.push('/analytics');
          }
        } else if (designation === 'RSK EXPERT') {
          const allowed = ['/', '/gis', '/analytics', '/knowledge'];
          if (!allowed.includes(pathname)) {
            router.push('/');
          }
        } else if (designation === 'MANDI HEAD') {
          const allowed = ['/analytics', '/gis'];
          if (!allowed.includes(pathname)) {
            router.push('/analytics');
          }
        }
      }
    }
  }, [token, user, pathname, isLoading, router]);

  const loginFarmer = async (name: string, villageName: string, phoneNumber: string, otp: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/farmer/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          name,
          village_name: villageName,
          otp
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: 'FARMER' }));
      
      setToken(data.token);
      setUser({ ...data.user, role: 'FARMER' });
      router.push('/diagnose');
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loginFarmerFirebase = async (name: string, villageName: string, idToken: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/farmer/verify-firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: idToken,
          name,
          village_name: villageName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Firebase verify failed');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: 'FARMER' }));
      
      setToken(data.token);
      setUser({ ...data.user, role: 'FARMER' });
      router.push('/diagnose');
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const signupProfessional = async (payload: any) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/professional/signup/verify-and-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: 'PROFESSIONAL' }));
      
      setToken(data.token);
      setUser({ ...data.user, role: 'PROFESSIONAL' });
      router.push('/');
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loginProfessional = async (email: string, password: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/professional/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid email or password');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: 'PROFESSIONAL' }));
      
      setToken(data.token);
      setUser({ ...data.user, role: 'PROFESSIONAL' });
      router.push('/');
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loginWithGoogle = async (idToken: string, rolePreference: string, villageName: string = "Google Region") => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/google/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: idToken,
          role_preference: rolePreference,
          village_name: villageName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google authentication verification failed');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: data.role }));
      
      setToken(data.token);
      setUser({ ...data.user, role: data.role });
      
      if (data.role === 'FARMER') {
        router.push('/diagnose');
      } else {
        router.push('/');
      }
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const signupWithGoogle = async (payload: any) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/google/signup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google registration failed');

      localStorage.setItem('kisan_auth_token', data.token);
      localStorage.setItem('kisan_auth_user', JSON.stringify({ ...data.user, role: data.role }));
      
      setToken(data.token);
      setUser({ ...data.user, role: data.role });
      
      if (data.role === 'FARMER') {
        router.push('/diagnose');
      } else {
        router.push('/');
      }
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('kisan_auth_token');
    localStorage.removeItem('kisan_auth_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginFarmer, loginFarmerFirebase, signupProfessional, loginProfessional, loginWithGoogle, signupWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
