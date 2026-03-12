'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DispatchStatusBadge, ItemStatusBadge } from '@/components/dispatch/StatusBadge';
import { ProgressBar } from '@/components/dispatch/ProgressBar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useWebSocket } from '@/lib/ws';
import { api, ApiError } from '@/lib/api';
import type { DispatchDetail } from '@/types';

export default function DispatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { subscribe } = useWebSocket();

  const dispatchId = params.id as string;
  const [dispatch, setDispatch] = useState<DispatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchDispatch = useCallback(async () => {
    try {
      const res = await api.getDispatch(dispatchId);
      setDispatch(res);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao carregar disparo');
    } finally {
      setLoading(false);
    }
  }, [dispatchId, toast]);

  useEffect(() => {
    fetchDispatch();
  }, [fetchDispatch]);

  // Subscribe to real-time progress
  useEffect(() => {
    const unsubscribe = subscribe(`dispatch:${dispatchId}`, (data) => {
      const progress = data as { sent: number; failed: number; total: number; status: string };
      setDispatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentCount: progress.sent,
          failedCount: progress.failed,
          totalGroups: progress.total,
          status: progress.status as DispatchDetail['status'],
        };
      });
    });

    return unsubscribe;
  }, [dispatchId, subscribe]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelDispatch(dispatchId);
      toast('success', 'Disparo cancelado');
      fetchDispatch();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao cancelar');
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.retryDispatch(dispatchId);
      toast('success', `Retentando ${res.retryCount} item(s)`);
      fetchDispatch();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao retentar');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!dispatch) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">Disparo nao encontrado</h2>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/dispatches')}>
          Voltar
        </Button>
      </div>
    );
  }

  const sent = dispatch.sentCount;
  const failed = dispatch.failedCount;
  const total = dispatch.totalGroups;
  const pending = total - sent - failed;
  const pctComplete = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

  // Avg latency from items
  const sentItems = dispatch.items.filter((i) => i.status === 'SENT' && i.sentAt);
  const avgLatencyMs = sentItems.length > 0
    ? sentItems.reduce((sum, item) => {
        const sentTime = new Date(item.sentAt!).getTime();
        const createdTime = new Date(item.createdAt).getTime();
        return sum + (sentTime - createdTime);
      }, 0) / sentItems.length
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dispatches')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalhes do Disparo</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{dispatch.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {dispatch.status === 'PENDING' && (
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling}>
              Cancelar
            </Button>
          )}
          {(dispatch.status === 'FAILED' || dispatch.status === 'PARTIAL') && (
            <Button variant="secondary" size="sm" onClick={handleRetry} loading={retrying}>
              Retentar Falhas
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <DispatchStatusBadge status={dispatch.status} />
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 mb-1">Enviados</p>
          <p className="text-2xl font-bold text-emerald-600">{sent}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 mb-1">Falhas</p>
          <p className="text-2xl font-bold text-red-600">{failed}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 mb-1">Latencia media</p>
          <p className="text-2xl font-bold text-gray-900">
            {avgLatencyMs > 0 ? `${Math.round(avgLatencyMs / 1000)}s` : '--'}
          </p>
        </Card>
      </div>

      {/* Progress */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Progresso</h2>
          <span className="text-sm font-medium text-gray-500">{pctComplete}%</span>
        </div>
        <ProgressBar sent={sent} failed={failed} total={total} />

        {dispatch.scheduledAt && (
          <p className="mt-3 text-xs text-gray-500">
            Agendado para: {new Date(dispatch.scheduledAt).toLocaleString('pt-BR')}
          </p>
        )}
      </Card>

      {/* Message */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Mensagem</h2>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
          {dispatch.copyTemplate}
        </div>
      </Card>

      {/* Per-group status */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Status por grupo</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {dispatch.items.map((item) => (
            <div key={item.id} className="px-6 py-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{item.group.name}</p>
                <p className="text-xs text-gray-400">
                  {item.session?.phoneNumber ?? 'Sem sessao'}
                  {item.sentAt && ` | Enviado em ${new Date(item.sentAt).toLocaleString('pt-BR', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.lastError && (
                  <span className="text-xs text-red-500 max-w-48 truncate" title={item.lastError}>
                    {item.lastError}
                  </span>
                )}
                <ItemStatusBadge status={item.status} />
              </div>
            </div>
          ))}

          {dispatch.items.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              Nenhum item encontrado
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
