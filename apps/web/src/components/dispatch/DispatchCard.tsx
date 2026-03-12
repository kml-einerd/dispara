'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DispatchStatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';
import type { Dispatch } from '@/types';

interface DispatchCardProps {
  dispatch: Dispatch;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  cancelling?: boolean;
  retrying?: boolean;
}

export function DispatchCard({ dispatch, onCancel, onRetry, cancelling, retrying }: DispatchCardProps) {
  const createdDate = new Date(dispatch.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const copyPreview = dispatch.copyTemplate.length > 120
    ? dispatch.copyTemplate.slice(0, 120) + '...'
    : dispatch.copyTemplate;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <DispatchStatusBadge status={dispatch.status} />
            <span className="text-xs text-gray-400">{createdDate}</span>
            {dispatch.scheduledAt && (
              <span className="text-xs text-indigo-500">
                Agendado: {new Date(dispatch.scheduledAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 line-clamp-2">{copyPreview}</p>
        </div>
        <Link
          href={`/dispatches/${dispatch.id}`}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium shrink-0"
        >
          Ver detalhes
        </Link>
      </div>

      <ProgressBar
        sent={dispatch.sentCount}
        failed={dispatch.failedCount}
        total={dispatch.totalGroups}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {dispatch.totalGroups} grupo{dispatch.totalGroups !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          {dispatch.status === 'PENDING' && onCancel && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(dispatch.id)} loading={cancelling}>
              Cancelar
            </Button>
          )}
          {(dispatch.status === 'FAILED' || dispatch.status === 'PARTIAL') && onRetry && (
            <Button variant="secondary" size="sm" onClick={() => onRetry(dispatch.id)} loading={retrying}>
              Retentar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
