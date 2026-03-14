import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase before importing the store
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { useAuthStore } from '../../store/auth';

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    tenantId: null,
    token: null,
    loading: true,
  });
});

describe('Auth Store', () => {
  it('estado inicial sem usuário nem token', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.tenantId).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('setState define user, token e tenantId', () => {
    const mockUser = { id: 'u1', email: 'test@test.com' } as any;
    const mockSession = { access_token: 'tok-123', user: mockUser } as any;

    useAuthStore.setState({
      user: mockUser,
      session: mockSession,
      token: 'tok-123',
      tenantId: 'tenant-abc',
      loading: false,
    });

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe('u1');
    expect(state.token).toBe('tok-123');
    expect(state.tenantId).toBe('tenant-abc');
    expect(state.loading).toBe(false);
  });

  it('clearAuth() reseta tudo', () => {
    useAuthStore.setState({
      user: { id: 'u1' } as any,
      session: { access_token: 'tok' } as any,
      token: 'tok',
      tenantId: 'tenant-1',
      loading: false,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.token).toBeNull();
    expect(state.tenantId).toBeNull();
  });

  it('initialize() em mock mode define dados mock', () => {
    // Temporarily set VITE_USE_MOCK
    const origEnv = import.meta.env.VITE_USE_MOCK;
    (import.meta.env as any).VITE_USE_MOCK = 'true';

    const unsub = useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.token).toBe('mock-token');
    expect(state.tenantId).toBe('tenant-1');
    expect(state.user?.email).toBe('mock@dispara.app');
    expect(state.loading).toBe(false);

    unsub();
    (import.meta.env as any).VITE_USE_MOCK = origEnv;
  });

  it('initialize() retorna função de cleanup', () => {
    (import.meta.env as any).VITE_USE_MOCK = 'true';
    const unsub = useAuthStore.getState().initialize();
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
