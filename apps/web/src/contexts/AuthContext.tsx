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
            name: u.user_metadata?.full_name ?? null,
            avatarUrl: u.user_metadata?.avatar_url ?? null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.tenant) {
            setTenant(data.tenant);
          }
        }
      } catch (err) {
        console.error('[AuthContext] backend sync failed:', err);
      }
    },
    [],
  );

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession) {
        syncWithBackend(initialSession).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

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
