'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';

interface Tenant {
  id: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const syncWithBackend = useCallback(
    async (currentSession: Session) => {
      const u = currentSession.user;
      console.log('[AuthContext] syncWithBackend for:', u.email);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const res = await fetch(`${API_BASE}/auth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            supabaseUserId: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
            avatarUrl: u.user_metadata?.avatar_url ?? null,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          console.log('[AuthContext] syncWithBackend success:', !!data.tenant);
          if (data.tenant) {
            setTenant(data.tenant);
            localStorage.setItem('tenant_id', data.tenant.id);
          }
        } else {
          console.warn('[AuthContext] syncWithBackend failed with status:', res.status);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.error('[AuthContext] syncWithBackend timeout');
        } else {
          console.error('[AuthContext] backend sync failed:', err);
        }
      }
    },
    [],
  );

  useEffect(() => {
    console.log('[AuthProvider] Initializing...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('[AuthProvider] Error getting session:', error);
      }
      
      console.log('[AuthProvider] Initial session:', !!initialSession);
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      
      if (initialSession) {
        localStorage.setItem('supabase_token', initialSession.access_token);
        syncWithBackend(initialSession).finally(() => {
          console.log('[AuthProvider] Sync finished');
          setLoading(false);
        });
      } else {
        localStorage.removeItem('supabase_token');
        localStorage.removeItem('tenant_id');
        setLoading(false);
      }
    }).catch(err => {
      console.error('[AuthProvider] getSession exception:', err);
      setLoading(false);
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[AuthProvider] Auth state change:', event, !!newSession);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession) {
        localStorage.setItem('supabase_token', newSession.access_token);
      } else {
        localStorage.removeItem('supabase_token');
        localStorage.removeItem('tenant_id');
      }

      if (event === 'SIGNED_IN' && newSession) {
        syncWithBackend(newSession);
      }

      if (event === 'SIGNED_OUT') {
        setTenant(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, syncWithBackend]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setTenant(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, tenant, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
