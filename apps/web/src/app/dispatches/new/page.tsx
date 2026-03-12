'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { WaGroup, WaSession } from '@/types';

type Step = 1 | 2 | 3 | 4;

function resolveSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, group: string) => {
    const options = group.split('|');
    return options[Math.floor(Math.random() * options.length)] ?? '';
  });
}

export default function NewDispatchPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [copyTemplate, setCopyTemplate] = useState('');
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [filterSession, setFilterSession] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [groupsRes, sessionsRes] = await Promise.all([
        api.listGroups({ limit: 100, isActive: 'true' }),
        api.listSessions(),
      ]);
      setGroups(groupsRes.data);
      setSessions(sessionsRes.sessions);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao carregar dados');
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate spintax preview
  useEffect(() => {
    if (copyTemplate.includes('{') && copyTemplate.includes('|')) {
      setPreview(resolveSpintax(copyTemplate));
    } else {
      setPreview('');
    }
  }, [copyTemplate]);

  const filteredGroups = filterSession
    ? groups.filter((g) => g.sessionId === filterSession)
    : groups;

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedGroupIds.size === filteredGroups.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(filteredGroups.map((g) => g.id)));
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: Parameters<typeof api.createDispatch>[0] = {
        copyTemplate,
        groupIds: Array.from(selectedGroupIds),
      };
      if (scheduleMode === 'schedule' && scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const res = await api.createDispatch(payload);
      toast('success', 'Disparo criado com sucesso!');
      router.push(`/dispatches/${res.id}`);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erro ao criar disparo');
    } finally {
      setCreating(false);
    }
  };

  const canAdvance = () => {
    switch (step) {
      case 1: return copyTemplate.trim().length > 0;
      case 2: return selectedGroupIds.size > 0;
      case 3: return scheduleMode === 'now' || (scheduleMode === 'schedule' && scheduledAt);
      case 4: return true;
      default: return false;
    }
  };

  const stepLabels = ['Mensagem', 'Grupos', 'Agendamento', 'Confirmar'];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Novo Disparo</h1>
        <p className="text-sm text-gray-500 mt-1">Crie um novo disparo em 4 etapas</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          const isActive = step === s;
          const isDone = step > s;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => isDone && setStep(s)}
                disabled={!isDone}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                  ${isActive ? 'bg-indigo-500 text-white' : isDone ? 'bg-indigo-100 text-indigo-700 cursor-pointer' : 'bg-gray-100 text-gray-400'}
                `}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : s}
              </button>
              <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-indigo-700' : isDone ? 'text-indigo-600' : 'text-gray-400'}`}>
                {label}
              </span>
              {i < 3 && <div className={`flex-1 h-px ${isDone ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Message */}
      {step === 1 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Escreva a mensagem</h2>
          <textarea
            className="w-full h-48 px-4 py-3 rounded-lg border border-gray-300 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
              placeholder:text-gray-400"
            placeholder="Digite sua mensagem aqui...

Use {opcao1|opcao2|opcao3} para variacoes automaticas (spintax)"
            value={copyTemplate}
            onChange={(e) => setCopyTemplate(e.target.value)}
          />

          {preview && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Preview (uma variacao possivel):</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap">
                {preview}
              </div>
              <button
                onClick={() => setPreview(resolveSpintax(copyTemplate))}
                className="mt-2 text-xs text-indigo-500 hover:text-indigo-700"
              >
                Gerar outra variacao
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Dica: Use spintax para variar automaticamente. Ex: {'"{Oferta|Promocao} {imperdivel|incrivel}!"'}
          </p>
        </Card>
      )}

      {/* Step 2: Groups */}
      {step === 2 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Selecione os grupos</h2>
            <span className="text-sm text-gray-500">{selectedGroupIds.size} selecionado(s)</span>
          </div>

          {sessions.length > 1 && (
            <div className="mb-4">
              <select
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterSession}
                onChange={(e) => setFilterSession(e.target.value)}
              >
                <option value="">Todas as sessoes</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phoneNumber || 'sem numero'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <button
              onClick={toggleAll}
              className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
            >
              {selectedGroupIds.size === filteredGroups.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nenhum grupo ativo encontrado.</p>
            ) : (
              filteredGroups.map((group) => (
                <label
                  key={group.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedGroupIds.has(group.id)
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.has(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{group.name}</p>
                    <p className="text-xs text-gray-500">
                      {group.memberCount} membros | {group.session.phoneNumber}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quando enviar?</h2>

          <div className="space-y-3">
            <label
              className={`
                flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                ${scheduleMode === 'now' ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}
              `}
            >
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Enviar agora</p>
                <p className="text-xs text-gray-500">Inicia o envio imediatamente (respeitando janela 09-12h, 14-18h BRT)</p>
              </div>
            </label>

            <label
              className={`
                flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                ${scheduleMode === 'schedule' ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}
              `}
            >
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === 'schedule'}
                onChange={() => setScheduleMode('schedule')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Agendar</p>
                <p className="text-xs text-gray-500">Escolha data e hora para o envio</p>
              </div>
            </label>

            {scheduleMode === 'schedule' && (
              <div className="pl-7">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirme o disparo</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Mensagem</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {copyTemplate}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Grupos</p>
                <p className="text-sm font-semibold text-gray-900">{selectedGroupIds.size} grupo(s)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Agendamento</p>
                <p className="text-sm font-semibold text-gray-900">
                  {scheduleMode === 'now' ? 'Enviar agora' : new Date(scheduledAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            {preview && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Preview (variacao)</p>
                <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-800 border border-emerald-200 whitespace-pre-wrap">
                  {preview}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => step === 1 ? router.push('/dispatches') : setStep((step - 1) as Step)}
        >
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        {step < 4 ? (
          <Button onClick={() => setStep((step + 1) as Step)} disabled={!canAdvance()}>
            Proximo
          </Button>
        ) : (
          <Button onClick={handleCreate} loading={creating}>
            Criar Disparo
          </Button>
        )}
      </div>
    </div>
  );
}
