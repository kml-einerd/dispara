'use client';

import { useState, type FormEvent } from 'react';

interface UnlockModalProps {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export function UnlockModal({ open, onClose, onUnlocked }: UnlockModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Preencha nome e email.');
      return;
    }

    setLoading(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const token = localStorage.getItem('supabase_token');
        const tenantId = localStorage.getItem('tenant_id');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (tenantId) headers['X-Tenant-ID'] = tenantId;
      } catch {}

      const res = await fetch(`${API_BASE}/gate/unlock`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || `Erro: ${res.status}`);
      }

      onUnlocked();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao desbloquear.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--color-card)] p-8 shadow-2xl"
        style={{ animation: 'animate-in 0.2s ease-out' }}
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-7 w-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Desbloquear PRO</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Acesso ilimitado a promos, grupos e disparos. Sem cartao, sem compromisso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="unlock-name" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Nome
            </label>
            <input
              id="unlock-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="unlock-email" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Email
            </label>
            <input
              id="unlock-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {loading ? 'Desbloqueando...' : 'Desbloquear agora'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Continuar no plano gratuito
        </button>
      </div>
    </div>
  );
}
