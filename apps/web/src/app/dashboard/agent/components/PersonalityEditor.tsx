'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const MAX_CHARS = 4000;

export function PersonalityEditor() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await api.getAgentConfig();
      setSystemPrompt(config.systemPrompt);
      setOriginalPrompt(config.systemPrompt);
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

  const handleSave = async () => {
    if (systemPrompt.length > MAX_CHARS) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const config = await api.updateAgentConfig({ systemPrompt });
      setSystemPrompt(config.systemPrompt);
      setOriginalPrompt(config.systemPrompt);
      setSuccessMessage('Personalidade salva com sucesso');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = systemPrompt !== originalPrompt;
  const charCount = systemPrompt.length;
  const isOverLimit = charCount > MAX_CHARS;

  if (loading) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Personalidade do Agente</h2>
          <p className="mt-1 text-sm text-gray-500">
            Defina o system prompt que guia o comportamento do agente
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Ex: Voce e um assistente de vendas especializado em ofertas e promoções. Responda de forma amigável e direta..."
            rows={8}
            className={`
              w-full px-3 py-2 rounded-lg border text-sm font-mono
              transition-colors duration-150 resize-y
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
              ${isOverLimit ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
              bg-white text-gray-900 placeholder:text-gray-400
            `}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-xs ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {charCount.toLocaleString('pt-BR')} / {MAX_CHARS.toLocaleString('pt-BR')} caracteres
            </span>
            {hasChanges && (
              <span className="text-xs text-amber-600">Alterações nao salvas</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isOverLimit}
            loading={saving}
            size="sm"
          >
            Salvar
          </Button>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSystemPrompt(originalPrompt)}
            >
              Descartar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
