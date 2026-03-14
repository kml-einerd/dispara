import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';

interface AuthState {
  user: User | null;
  session: Session | null;
  tenantId: string | null;
  token: string | null;
  loading: boolean;
  initialize: () => () => void;
  clearAuth: () => void;
}

async function syncWithBackend(session: Session): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        supabaseUserId: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata?.full_name || session.user.email!.split('@')[0],
        avatarUrl: session.user.user_metadata?.avatar_url || null,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.tenant?.id ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  tenantId: null,
  token: null,
  loading: true,

  initialize: () => {
    const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
    if (USE_MOCK) {
      set({
        loading: false,
        session: { access_token: 'mock-token', user: { id: 'mock-user', email: 'mock@dispara.app', user_metadata: { full_name: 'Usuário Mock' } } } as any,
        user: { id: 'mock-user', email: 'mock@dispara.app', user_metadata: { full_name: 'Usuário Mock' } } as any,
        token: 'mock-token',
        tenantId: 'tenant-1',
      });
      return () => {};
    }

    const handleSession = async (session: Session | null) => {
      if (!session) {
        set({ user: null, session: null, token: null, tenantId: null, loading: false });
        return;
      }
      const tenantId = await syncWithBackend(session);
      set({
        user: session.user,
        session,
        token: session.access_token,
        tenantId,
        loading: false,
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  },

  clearAuth: () => {
    supabase.auth.signOut();
    set({ user: null, session: null, tenantId: null, token: null });
  },
}));
