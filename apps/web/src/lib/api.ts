import { useAuthStore } from '../store/auth';
import { supabase } from './supabase';
import { mockSessions, mockGroups, mockProducts, mockPromos, mockDispatches, mockAffiliateAccounts, mockGateStatus, mockDispatchesExtended } from './api-mock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

async function fetcher(url: string, options: RequestInit = {}) {
  const { token, tenantId } = useAuthStore.getState();

  if (USE_MOCK) {
    console.log(`[MOCK API] ${options.method || 'GET'} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    if (url.includes('/wa/sessions')) {
      if (url.endsWith('/qr')) return { qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', status: 'PENDING' };
      if (url.endsWith('/health')) return { healthScore: 85, warmupDay: 10, dailyMsgCount: 50 };
      return { sessions: mockSessions };
    }
    if (url.includes('/groups')) return { data: mockGroups, pagination: { total: 3 } };
    if (url.includes('/promos')) {
      return { data: mockPromos, pagination: { total: 1 } };
    }
    if (url.includes('/dispatches')) return { data: mockDispatchesExtended, pagination: { total: mockDispatchesExtended.length } };
    if (url.includes('/oauth/accounts')) return { accounts: mockAffiliateAccounts };
    if (url.includes('/oauth/mercadolivre/connect')) return { url: 'https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=MOCK' };
    if (url.includes('/oauth/shopee/connect')) return { account: mockAffiliateAccounts[0] };
    if (url.includes('/affiliate-accounts')) return { accounts: mockAffiliateAccounts };
    if (url.includes('/gate/status')) return mockGateStatus;

    return {};
  }

  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  };

  // Don't set Content-Type for FormData — browser sets it with boundary
  const incomingHeaders = options.headers as Record<string, string> | undefined;
  if (incomingHeaders?.['Content-Type']) {
    headers['Content-Type'] = incomingHeaders['Content-Type'];
  } else if (!options.body || !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (data.session) {
      useAuthStore.setState({
        token: data.session.access_token,
        session: data.session,
        user: data.session.user,
      });
      const retryResponse = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
          ...headers,
          'Authorization': `Bearer ${data.session.access_token}`,
        },
      });
      if (!retryResponse.ok) {
        const err = await retryResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(err.message || 'Erro na requisição');
      }
      return retryResponse.json();
    }
    useAuthStore.getState().clearAuth();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || 'Erro na requisição');
  }

  return response.json();
}

export const api = {
  get: (url: string) => fetcher(url),
  post: (url: string, data?: any) => fetcher(url, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }),
  delete: (url: string) => fetcher(url, { method: 'DELETE' }),
};
