'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { SessionCard } from '@/components/dispatch/SessionCard';
import { QRCodeModal } from '@/components/dispatch/QRCodeModal';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { WaSession } from '@/types';

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // New session modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // QR modal
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.listSessions();
      setSessions(res.sessions);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao carregar sessoes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createSession(newName.trim());
      setShowNewModal(false);
      setNewName('');
      toast('success', 'Sessao criada! Escaneie o QR code.');
      setQrSessionId(res.sessionId);
      setShowQr(true);
      fetchSessions();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao criar sessao');
    } finally {
      setCreating(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectingId(id);
    try {
      await api.deleteSession(id);
      toast('success', 'Sessao desconectada');
      fetchSessions();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao desconectar');
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleQrConnected = useCallback(() => {
    toast('success', 'WhatsApp conectado com sucesso!');
    setShowQr(false);
    setQrSessionId(null);
    fetchSessions();
  }, [toast, fetchSessions]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie suas sessoes WhatsApp</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Conectar Numero
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhuma sessao</h3>
          <p className="text-sm text-gray-500 mb-4">Conecte um numero WhatsApp para comecar a enviar disparos.</p>
          <Button onClick={() => setShowNewModal(true)}>Conectar Numero</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDisconnect={handleDisconnect}
              disconnecting={disconnectingId === session.id}
            />
          ))}
        </div>
      )}

      {/* New Session Dialog */}
      <Dialog open={showNewModal} onClose={() => setShowNewModal(false)} title="Conectar Novo Numero">
        <div className="space-y-4">
          <Input
            label="Nome da sessao"
            placeholder="Ex: Numero Principal"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
              Criar e Gerar QR
            </Button>
          </div>
        </div>
      </Dialog>

      {/* QR Code Modal */}
      <QRCodeModal
        open={showQr}
        onClose={() => { setShowQr(false); setQrSessionId(null); }}
        sessionId={qrSessionId}
        onConnected={handleQrConnected}
      />
    </div>
  );
}
