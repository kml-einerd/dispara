'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AgentInteraction, AgentIntent } from '@/types';
import { AGENT_INTENT_LABELS, AGENT_INTENT_VARIANTS } from '@/types';

const INTENT_OPTIONS = [
  { value: '', label: 'Todos os intents' },
  ...Object.entries(AGENT_INTENT_LABELS).map(([value, label]) => ({ value, label })),
];

const PAGE_SIZE = 20;

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export function InteractionLog() {
  const [interactions, setInteractions] = useState<AgentInteraction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [intentFilter, setIntentFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch groups for filter dropdown
  useEffect(() => {
    api.listAgentChannels()
      .then((channels) => {
        setGroups([
          { value: '', label: 'Todos os grupos' },
          ...channels.map((ch) => ({ value: ch.id, label: ch.name })),
        ]);
      })
      .catch(() => {
        // Silently fail - filter just won't have group options
      });
  }, []);

  const fetchInteractions = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params: Record<string, string | number | undefined> = {
        limit: PAGE_SIZE,
      };
      if (!reset && cursor) params.cursor = cursor;
      if (intentFilter) params.intent = intentFilter as AgentIntent;
      if (groupFilter) params.groupId = groupFilter;

      const result = await api.listAgentInteractions(params as Parameters<typeof api.listAgentInteractions>[0]);

      if (reset) {
        setInteractions(result.data);
      } else {
        setInteractions((prev) => [...prev, ...result.data]);
      }
      setCursor(result.cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar interações');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, intentFilter, groupFilter]);

  // Reset on filter change
  useEffect(() => {
    setCursor(null);
    setInteractions([]);
    fetchInteractions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentFilter, groupFilter]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && !loadingMore) {
          fetchInteractions(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, loadingMore, fetchInteractions]);

  return (
    <Card padding={false}>
      <div className="p-6 pb-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Log de Interações</h2>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select
              options={INTENT_OPTIONS}
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              placeholder="Filtrar por intent"
            />
          </div>
          {groups.length > 1 && (
            <div className="w-full sm:w-48">
              <Select
                options={groups}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                placeholder="Filtrar por grupo"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Horário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grupo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mensagem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Intent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resposta
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tempo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-6 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-6 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-6 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                  <td className="px-6 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-6 py-3"><Skeleton className="h-4 w-14" /></td>
                </tr>
              ))
            ) : interactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  Nenhuma interação encontrada
                </td>
              </tr>
            ) : (
              interactions.map((interaction) => (
                <tr key={interaction.id} className="hover:bg-gray-50 transition-colors duration-100">
                  <td className="px-6 py-3 whitespace-nowrap text-gray-500">
                    {formatTime(interaction.createdAt)}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={interaction.platform} />
                      <span className="text-gray-900 font-medium">
                        {truncate(interaction.groupName, 20)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-700 max-w-[200px]">
                    <span title={interaction.userMessage}>
                      {truncate(interaction.userMessage, 50)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={AGENT_INTENT_VARIANTS[interaction.intent]}>
                      {AGENT_INTENT_LABELS[interaction.intent] ?? interaction.intent}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-gray-700 max-w-[200px]">
                    <span title={interaction.agentResponse}>
                      {truncate(interaction.agentResponse, 50)}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-gray-500">
                    {formatResponseTime(interaction.responseTimeMs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more sentinel */}
      {cursor && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      )}

      {!cursor && interactions.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-4">
          Mostrando todas as {interactions.length} interações
        </p>
      )}
    </Card>
  );
}

function PlatformIcon({ platform }: { platform: 'whatsapp' | 'telegram' }) {
  if (platform === 'whatsapp') {
    return (
      <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
