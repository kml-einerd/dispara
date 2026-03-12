'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SessionStatusBadge } from './StatusBadge';
import { HealthIndicator } from './HealthIndicator';
import type { WaSession } from '@/types';

interface SessionCardProps {
  session: WaSession;
  onDisconnect: (id: string) => void;
  disconnecting?: boolean;
}

export function SessionCard({ session, onDisconnect, disconnecting }: SessionCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{session.name}</h3>
            <p className="text-xs text-gray-500">
              {session.phoneNumber || 'Aguardando conexao...'}
            </p>
          </div>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500">Saude</p>
          <HealthIndicator score={session.healthScore} size="sm" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Aquecimento</p>
          <p className="text-sm font-medium text-gray-900">Dia {session.warmupDay}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Msgs Hoje</p>
          <p className="text-sm font-medium text-gray-900">{session.dailyMsgCount}</p>
        </div>
      </div>

      {session.status === 'CONNECTED' && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDisconnect(session.id)}
          loading={disconnecting}
          className="w-full"
        >
          Desconectar
        </Button>
      )}
    </Card>
  );
}
