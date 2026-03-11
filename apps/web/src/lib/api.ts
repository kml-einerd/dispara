import type {
  ApiResponse,
  PaginatedResponse,
  Promo,
  PromoWithVariations,
  CreatePromoPayload,
  UpdatePromoPayload,
  CopyVariation,
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
  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'dev-tenant-id',
      'X-User-ID': 'dev-user-id',
    };
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
}

export const api = new ApiClient();
export { ApiError };
