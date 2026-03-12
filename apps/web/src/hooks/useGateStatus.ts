'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface GateFeature {
  feature: string;
  limit: number | null; // null = unlimited
  used: number;
  exceeded: boolean;
}

export interface GateStatus {
  plan: string;
  periodStart: string;
  periodEnd: string;
  features: GateFeature[];
}

interface UseGateStatusReturn {
  status: GateStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isExceeded: (feature: string) => boolean;
  isPremium: boolean;
}

export function useGateStatus(): UseGateStatusReturn {
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Use the raw fetch approach matching api client pattern
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

    fetch(`${API_BASE}/gate/status`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Gate status failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStatus(data as GateStatus);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to fetch gate status');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trigger]);

  const isExceeded = useCallback(
    (feature: string): boolean => {
      if (!status) return false;
      const f = status.features.find((ft) => ft.feature === feature);
      return f?.exceeded ?? false;
    },
    [status],
  );

  const isPremium = status?.plan !== 'STARTER';

  return { status, loading, error, refetch, isExceeded, isPremium };
}

/**
 * Read auth headers from localStorage (matches the api client pattern).
 */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const h: Record<string, string> = {};
  try {
    const token = localStorage.getItem('supabase_token');
    const tenantId = localStorage.getItem('tenant_id');
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (tenantId) h['X-Tenant-ID'] = tenantId;
  } catch {
    // SSR or storage unavailable
  }
  return h;
}
