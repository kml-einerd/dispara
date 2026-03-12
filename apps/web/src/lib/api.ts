import type {
  ApiResponse,
  PaginatedResponse,
  Promo,
  PromoWithVariations,
  CreatePromoPayload,
  UpdatePromoPayload,
  CopyVariation,
  WaSessionListResponse,
  QrResponse,
  CreateSessionResponse,
  WaSessionHealthResponse,
  GroupListResponse,
  ImportGroupsResponse,
  WaGroup,
  DispatchListResponse,
  DispatchDetail,
  CreateDispatchPayload,
  CreateDispatchResponse,
  AgentConfig,
  AgentStats,
  AgentInteractionListResponse,
  AgentGroupChannel,
  AgentIntent,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private token: string | null = null;
  private tenantId: string | null = null;

  setAuth(token: string | null, tenantId: string | null) {
    this.token = token;
    this.tenantId = tenantId;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.tenantId) {
      h['X-Tenant-ID'] = this.tenantId;
    } else if (!this.token) {
      // Dev fallback when no auth is configured
      h['X-Tenant-ID'] = 'dev-tenant-id';
    }

    return h;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      let message: string;
      try {
        const json = JSON.parse(body);
        message = json.message || json.error || body;
      } catch {
        message = body || `HTTP ${res.status}`;
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // ========== Promos ==========

  async createPromo(data: CreatePromoPayload): Promise<ApiResponse<PromoWithVariations>> {
    return this.request('/promos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listPromos(params: {
    page?: number;
    limit?: number;
    status?: string;
    marketplace?: string;
    search?: string;
  } = {}): Promise<PaginatedResponse<Promo>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.marketplace) searchParams.set('marketplace', params.marketplace);
    if (params.search) searchParams.set('search', params.search);

    const qs = searchParams.toString();
    return this.request(`/promos${qs ? `?${qs}` : ''}`);
  }

  async getPromo(id: string): Promise<ApiResponse<PromoWithVariations>> {
    return this.request(`/promos/${id}`);
  }

  async updatePromo(id: string, data: UpdatePromoPayload): Promise<ApiResponse<Promo>> {
    return this.request(`/promos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePromo(id: string): Promise<void> {
    return this.request(`/promos/${id}`, { method: 'DELETE' });
  }

  async generateVariations(
    id: string,
    count: number = 3,
  ): Promise<ApiResponse<CopyVariation[]>> {
    return this.request(`/promos/${id}/variations`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
  }

  // ========== WhatsApp Sessions ==========

  async listSessions(): Promise<WaSessionListResponse> {
    return this.request('/wa/sessions');
  }

  async createSession(name: string): Promise<CreateSessionResponse> {
    return this.request('/wa/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteSession(id: string): Promise<{ success: boolean }> {
    return this.request(`/wa/sessions/${id}`, { method: 'DELETE' });
  }

  async getSessionQr(id: string): Promise<QrResponse> {
    return this.request(`/wa/sessions/${id}/qr`);
  }

  async getSessionHealth(id: string): Promise<WaSessionHealthResponse> {
    return this.request(`/wa/sessions/${id}/health`);
  }

  // ========== Groups ==========

  async listGroups(params: {
    sessionId?: string;
    isActive?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<GroupListResponse> {
    const searchParams = new URLSearchParams();
    if (params.sessionId) searchParams.set('sessionId', params.sessionId);
    if (params.isActive) searchParams.set('isActive', params.isActive);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return this.request(`/groups${qs ? `?${qs}` : ''}`);
  }

  async importGroups(sessionId: string): Promise<ImportGroupsResponse> {
    return this.request('/groups/import', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async updateGroup(id: string, data: { isActive?: boolean }): Promise<WaGroup> {
    return this.request(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== Dispatches ==========

  async listDispatches(params: {
    status?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<DispatchListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return this.request(`/dispatches${qs ? `?${qs}` : ''}`);
  }

  async getDispatch(id: string): Promise<DispatchDetail> {
    return this.request(`/dispatches/${id}`);
  }

  async createDispatch(data: CreateDispatchPayload): Promise<CreateDispatchResponse> {
    return this.request('/dispatches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelDispatch(id: string): Promise<{ status: string; id: string }> {
    return this.request(`/dispatches/${id}`, { method: 'DELETE' });
  }

  async retryDispatch(id: string): Promise<{ status: string; retryCount: number }> {
    return this.request(`/dispatches/${id}/retry`, { method: 'POST' });
  }
  // ========== AI Agent ==========

  async getAgentConfig(): Promise<AgentConfig> {
    return this.request('/agent/config');
  }

  async updateAgentConfig(data: Partial<AgentConfig>): Promise<AgentConfig> {
    return this.request('/agent/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAgentStats(period: 'day' | 'week' | 'month' = 'week'): Promise<AgentStats> {
    return this.request(`/agent/stats?period=${period}`);
  }

  async listAgentInteractions(params: {
    cursor?: string;
    limit?: number;
    intent?: AgentIntent;
    groupId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<AgentInteractionListResponse> {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.intent) searchParams.set('intent', params.intent);
    if (params.groupId) searchParams.set('groupId', params.groupId);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);

    const qs = searchParams.toString();
    return this.request(`/agent/interactions${qs ? `?${qs}` : ''}`);
  }

  async listAgentChannels(): Promise<AgentGroupChannel[]> {
    return this.request('/agent/channels');
  }

  async updateAgentChannel(id: string, data: { agentEnabled: boolean }): Promise<AgentGroupChannel> {
    return this.request(`/agent/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
export { ApiError };
