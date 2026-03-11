'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  Promo,
  PromoWithVariations,
  PaginatedResponse,
  PromoFilters,
  CreatePromoPayload,
  UpdatePromoPayload,
} from '@/types';

// ============================================
// usePromos — list with pagination & filters
// ============================================

interface UsePromosReturn {
  data: Promo[];
  pagination: PaginatedResponse<Promo>['pagination'] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePromos(filters: PromoFilters = {}): UsePromosReturn {
  const [data, setData] = useState<Promo[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Promo>['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const f = filtersRef.current;
    api
      .listPromos({
        page: f.page || 1,
        limit: f.limit || 20,
        status: f.status || undefined,
        marketplace: f.marketplace || undefined,
        search: f.search || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar promos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    filters.page,
    filters.limit,
    filters.status,
    filters.marketplace,
    filters.search,
    trigger,
  ]);

  return { data, pagination, loading, error, refetch };
}

// ============================================
// usePromo — single promo detail
// ============================================

interface UsePromoReturn {
  data: PromoWithVariations | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePromo(id: string): UsePromoReturn {
  const [data, setData] = useState<PromoWithVariations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getPromo(id)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar promo');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, trigger]);

  return { data, loading, error, refetch };
}

// ============================================
// useCreatePromo — mutation
// ============================================

interface UseMutationReturn<TData, TPayload> {
  mutate: (payload: TPayload) => Promise<TData>;
  loading: boolean;
  error: string | null;
}

export function useCreatePromo(): UseMutationReturn<PromoWithVariations, CreatePromoPayload> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (payload: CreatePromoPayload): Promise<PromoWithVariations> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createPromo(payload);
      return res.data;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao criar promo';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

// ============================================
// useUpdatePromo — mutation
// ============================================

export function useUpdatePromo(): UseMutationReturn<Promo, { id: string; data: UpdatePromoPayload }> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async ({ id, data }: { id: string; data: UpdatePromoPayload }): Promise<Promo> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.updatePromo(id, data);
      return res.data;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao atualizar promo';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

// ============================================
// useDeletePromo — mutation
// ============================================

export function useDeletePromo(): UseMutationReturn<void, string> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.deletePromo(id);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao excluir promo';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}
