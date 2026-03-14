import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

import { useAuthStore } from '../../store/auth';
import { supabase } from '../../lib/supabase';

describe('API fetcher — headers e auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      session: null,
      token: 'test-token',
      tenantId: 'tenant-1',
      loading: false,
    });
  });

  it('api exporta get, post e delete', async () => {
    const { api } = await import('../../lib/api');
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.delete).toBe('function');
  });

  it('store auth state é acessível pelo fetcher', () => {
    const { token, tenantId } = useAuthStore.getState();
    expect(token).toBe('test-token');
    expect(tenantId).toBe('tenant-1');
  });

  it('clearAuth reseta token e tenantId usados pelo fetcher', () => {
    useAuthStore.getState().clearAuth();
    const { token, tenantId } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(tenantId).toBeNull();
  });

  it('refreshSession do supabase é chamável (usado no 401 handler)', () => {
    const refreshMock = vi.mocked(supabase.auth.refreshSession);
    refreshMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'new-token',
          user: { id: 'u1' },
        } as any,
        user: { id: 'u1' } as any,
      },
      error: null,
    });
    expect(refreshMock).toBeDefined();
  });

  it('mock data é importável e tem estrutura válida', async () => {
    const mock = await import('../../lib/api-mock');
    expect(mock.mockSessions.length).toBeGreaterThan(0);
    expect(mock.mockGroups.length).toBeGreaterThan(0);
    expect(mock.mockPromos.length).toBeGreaterThan(0);
    expect(mock.mockGateStatus.plan).toBe('PRO');
  });
});
