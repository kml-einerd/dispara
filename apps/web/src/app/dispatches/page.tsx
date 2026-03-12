'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DispatchCard } from '@/components/dispatch/DispatchCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { Dispatch, DispatchStatus } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'COMPLETED', label: 'Concluido' },
  { value: 'PARTIAL', label: 'Parcial' },
  { value: 'FAILED', label: 'Falhou' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export default function DispatchesPage() {
  const { toast } = useToast();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDispatches = useCallback(async () => {
    try {
      const params: { status?: string; limit?: number } = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.listDispatches(params);
      setDispatches(res.data);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao carregar disparos');
    } finally {
      setLoading(false);
    }
  }, [toast, statusFilter]);

  useEffect(() => {
    fetchDispatches();
  }, [fetchDispatches]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelDispatch(id);
      toast('success', 'Disparo cancelado');
      fetchDispatches();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao cancelar');
    } finally {
      setCancellingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await api.retryDispatch(id);
      toast('success', `Retentando ${res.retryCount} item(s)`);
      fetchDispatches();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao retentar');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disparos</h1>
          <p className="text-sm text-gray-500 mt-1">Historico de todos os disparos</p>
        </div>
        <Link href="/dispatches/new">
          <Button>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Novo Disparo
          </Button>
        </Link>
      </div>

      <div className="mb-4 max-w-xs">
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum disparo</h3>
          <p className="text-sm text-gray-500 mb-4">Crie seu primeiro disparo para enviar mensagens aos grupos.</p>
          <Link href="/dispatches/new">
            <Button>Criar Disparo</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map((dispatch) => (
            <DispatchCard
              key={dispatch.id}
              dispatch={dispatch}
              onCancel={handleCancel}
              onRetry={handleRetry}
              cancelling={cancellingId === dispatch.id}
              retrying={retryingId === dispatch.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
