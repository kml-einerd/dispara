'use client';

import { useState, type ReactNode } from 'react';
import { useGateStatus } from '@/hooks/useGateStatus';
import { UnlockModal } from './UnlockModal';

interface UsageGateProps {
  feature: 'promos' | 'dispatches' | 'groups';
  children: ReactNode;
}

const FEATURE_LABELS: Record<string, { singular: string; plural: string; limit: string }> = {
  promos:      { singular: 'promo',    plural: 'promos',    limit: '1 promo' },
  dispatches:  { singular: 'disparo',  plural: 'disparos',  limit: '50 disparos/mes' },
  groups:      { singular: 'grupo',    plural: 'grupos',    limit: '5 grupos' },
};

export function UsageGate({ feature, children }: UsageGateProps) {
  const { status, loading, isExceeded, refetch } = useGateStatus();
  const [showModal, setShowModal] = useState(false);

  const exceeded = isExceeded(feature);
  const label = FEATURE_LABELS[feature] ?? { singular: feature, plural: feature, limit: feature };

  const featureData = status?.features.find((f) => f.feature === feature);

  return (
    <div className="relative">
      {children}

      {/* Overlay when limit exceeded */}
      {!loading && exceeded && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-[var(--color-text)]">
              Limite atingido
            </h3>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Voce usou{' '}
              <span className="font-semibold text-[var(--color-text)]">
                {featureData?.used ?? '?'}/{featureData?.limit ?? '?'}
              </span>{' '}
              {label.plural} do plano gratuito.
            </p>

            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Desbloqueie o plano PRO para acesso ilimitado.
            </p>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              Desbloquear PRO
            </button>
          </div>
        </div>
      )}

      <UnlockModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onUnlocked={() => {
          setShowModal(false);
          refetch();
        }}
      />
    </div>
  );
}
