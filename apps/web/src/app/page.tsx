'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DispatchStatusBadge, SessionStatusBadge } from '@/components/dispatch/StatusBadge';
import { HealthIndicator } from '@/components/dispatch/HealthIndicator';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import type { WaSession, WaGroup, Dispatch } from '@/types';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [sessionsRes, groupsRes, dispatchesRes] = await Promise.allSettled([
        api.listSessions(),
        api.listGroups({ limit: 100 }),
        api.listDispatches({ limit: 5 }),
      ]);

      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value.sessions);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.data);
      if (dispatchesRes.status === 'fulfilled') setDispatches(dispatchesRes.value.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const connectedSessions = sessions.filter((s) => s.status === 'CONNECTED');
  const activeGroups = groups.filter((g) => g.isActive);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visao geral do sistema de disparos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/whatsapp">
          <Card hover className="h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sessoes Ativas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{connectedSessions.length}</p>
                <p className="text-xs text-gray-400 mt-1">{sessions.length} total</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/groups">
          <Card hover className="h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grupos Ativos</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{activeGroups.length}</p>
                <p className="text-xs text-gray-400 mt-1">{groups.length} total</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dispatches">
          <Card hover className="h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Disparos Recentes</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{dispatches.length}</p>
                <p className="text-xs text-gray-400 mt-1">ultimos 5</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Sessions Overview */}
      {sessions.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Sessoes WhatsApp</h2>
            <Link href="/whatsapp" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{session.name}</p>
                    <p className="text-xs text-gray-500">{session.phoneNumber || 'Sem numero'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HealthIndicator score={session.healthScore} size="sm" />
                  <SessionStatusBadge status={session.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Dispatches */}
      {dispatches.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Disparos Recentes</h2>
            <Link href="/dispatches" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {dispatches.map((dispatch) => {
              const copyPreview = dispatch.copyTemplate.length > 80
                ? dispatch.copyTemplate.slice(0, 80) + '...'
                : dispatch.copyTemplate;

              return (
                <Link key={dispatch.id} href={`/dispatches/${dispatch.id}`} className="block py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 truncate">{copyPreview}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dispatch.totalGroups} grupo(s) | {new Date(dispatch.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <DispatchStatusBadge status={dispatch.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
