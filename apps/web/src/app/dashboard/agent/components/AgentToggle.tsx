'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export function AgentToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await api.getAgentConfig();
      setEnabled(config.enabled);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleToggle = async () => {
    try {
      setToggling(true);
      setError(null);
      const config = await api.updateAgentConfig({ enabled: !enabled });
      setEnabled(config.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-7 w-12 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
      <span className="text-sm text-gray-600">
        {enabled ? 'Ativo' : 'Inativo'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Desativar agente' : 'Ativar agente'}
        disabled={toggling}
        onClick={handleToggle}
        className={`
          relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${enabled ? 'bg-indigo-500' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm
            ring-0 transition-transform duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}
