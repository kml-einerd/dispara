'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { GroupCard } from '@/components/dispatch/GroupCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { WaGroup, WaSession } from '@/types';

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importSessionId, setImportSessionId] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const params: { sessionId?: string; limit?: number } = { limit: 100 };
      if (filterSession) params.sessionId = filterSession;
      const res = await api.listGroups(params);
      setGroups(res.data);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }, [toast, filterSession]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.listSessions();
      setSessions(res.sessions);
    } catch {
      // Silently fail — sessions list is secondary
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchSessions();
  }, [fetchGroups, fetchSessions]);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setTogglingId(id);
    try {
      await api.updateGroup(id, { isActive });
      setGroups((prev) => prev.map((g) => g.id === id ? { ...g, isActive } : g));
      toast('success', isActive ? 'Grupo ativado' : 'Grupo desativado');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao atualizar grupo');
    } finally {
      setTogglingId(null);
    }
  };

  const handleImport = async () => {
    if (!importSessionId) return;
    setImporting(true);
    try {
      const res = await api.importGroups(importSessionId);
      toast('success', `${res.imported} grupos importados`);
      setShowImport(false);
      setImportSessionId('');
      fetchGroups();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao importar grupos');
    } finally {
      setImporting(false);
    }
  };

  const connectedSessions = sessions.filter((s) => s.status === 'CONNECTED');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grupos</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os grupos de todas as sessoes</p>
        </div>
        <Button onClick={() => setShowImport(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Importar do WhatsApp
        </Button>
      </div>

      {/* Session filter */}
      {sessions.length > 1 && (
        <div className="mb-4 max-w-xs">
          <Select
            options={[
              { value: '', label: 'Todas as sessoes' },
              ...sessions.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.phoneNumber || 'sem numero'})`,
              })),
            ]}
            value={filterSession}
            onChange={(e) => { setFilterSession(e.target.value); setLoading(true); }}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum grupo</h3>
          <p className="text-sm text-gray-500 mb-4">Importe grupos de uma sessao WhatsApp conectada.</p>
          <Button onClick={() => setShowImport(true)}>Importar Grupos</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onToggleActive={handleToggleActive}
              toggling={togglingId === group.id}
            />
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onClose={() => setShowImport(false)} title="Importar Grupos do WhatsApp">
        <div className="space-y-4">
          {connectedSessions.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma sessao WhatsApp conectada. Conecte um numero primeiro.
            </p>
          ) : (
            <>
              <Select
                label="Selecione a sessao"
                placeholder="Escolha uma sessao..."
                options={connectedSessions.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.phoneNumber})`,
                }))}
                value={importSessionId}
                onChange={(e) => setImportSessionId(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowImport(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} loading={importing} disabled={!importSessionId}>
                  Importar
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
