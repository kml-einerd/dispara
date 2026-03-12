'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePromo, useUpdatePromo, useDeletePromo } from '@/hooks/usePromos';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { CopyVariationCard } from '@/components/promos/CopyVariationCard';
import { WhatsAppPreview } from '@/components/promos/WhatsAppPreview';
import type { PromoStatus } from '@/types';
import {
  MARKETPLACE_LABELS,
  MARKETPLACE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/types';
import { formatCurrency, formatDiscount, formatDate } from '@/lib/format';

export default function PromoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const promoId = params.id as string;

  const { data: promo, loading, error, refetch } = usePromo(promoId);
  const { mutate: updatePromo, loading: updating } = useUpdatePromo();
  const { mutate: deletePromo, loading: deleting } = useDeletePromo();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // ============================================
  // Handlers
  // ============================================

  const handleSelectVariation = async (variationId: string) => {
    if (!promo) return;
    const variation = promo.variations.find((v) => v.id === variationId);
    try {
      await updatePromo({
        id: promoId,
        data: {
          selectedVariationId: variationId,
          selectedCopy: variation?.content,
        },
      });
      refetch();
      toast('success', 'Variação selecionada');
    } catch {
      toast('error', 'Erro ao selecionar variação');
    }
  };

  const handleUpdateName = async () => {
    if (!nameValue.trim()) return;
    try {
      await updatePromo({
        id: promoId,
        data: { productName: nameValue.trim() },
      });
      setEditingName(false);
      refetch();
      toast('success', 'Nome atualizado');
    } catch {
      toast('error', 'Erro ao atualizar nome');
    }
  };

  const handleStatusChange = async (status: PromoStatus) => {
    try {
      await updatePromo({
        id: promoId,
        data: { status },
      });
      refetch();
      toast('success', `Promo ${STATUS_LABELS[status].toLowerCase()}`);
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  };

  const handleDelete = async () => {
    try {
      await deletePromo(promoId);
      toast('success', 'Promo excluída');
      router.push('/promos');
    } catch {
      toast('error', 'Erro ao excluir promo');
    }
  };

  const handleCopyLink = async () => {
    if (!promo?.affiliateUrl) return;
    try {
      await navigator.clipboard.writeText(promo.affiliateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast('success', 'Link copiado!');
    } catch {
      // Fallback
    }
  };

  // ============================================
  // Loading state
  // ============================================

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex gap-6">
                <Skeleton className="w-32 h-32 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                  <SkeletonText lines={4} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SkeletonText lines={3} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Error state
  // ============================================

  if (error || !promo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Promo não encontrada</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'Esta promo não existe ou foi removida.'}</p>
        <Link href="/promos">
          <Button>Voltar para Promos</Button>
        </Link>
      </div>
    );
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link
            href="/promos"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Voltar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 outline-none bg-transparent px-0 py-0.5 w-full max-w-md"
                />
                <Button size="sm" onClick={handleUpdateName} loading={updating}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold text-gray-900 truncate cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => {
                  setNameValue(promo.productName);
                  setEditingName(true);
                }}
                title="Clique para editar"
              >
                {promo.productName}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[promo.status]}`}>
                {STATUS_LABELS[promo.status]}
              </span>
              <span className="text-xs text-gray-400">
                Criada em {formatDate(promo.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            {showPreview ? 'Ocultar Preview' : 'Preview WhatsApp'}
          </Button>

          {promo.status === 'DRAFT' && (
            <Button size="sm" onClick={() => handleStatusChange('ACTIVE')} loading={updating}>
              Ativar
            </Button>
          )}
          {promo.status === 'ACTIVE' && (
            <Button size="sm" variant="secondary" onClick={() => handleStatusChange('ARCHIVED')} loading={updating}>
              Arquivar
            </Button>
          )}
          {promo.status === 'ARCHIVED' && (
            <Button size="sm" variant="secondary" onClick={() => handleStatusChange('ACTIVE')} loading={updating}>
              Reativar
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowDeleteDialog(true)}
          >
            Excluir
          </Button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className={`space-y-6 ${showPreview ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {/* Product info card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-32 h-32 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {promo.imageUrl ? (
                  <img
                    src={promo.imageUrl}
                    alt={promo.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-3">
                  {promo.marketplace && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${MARKETPLACE_COLORS[promo.marketplace]}`}>
                      {MARKETPLACE_LABELS[promo.marketplace]}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3 mb-4">
                  {promo.promoPrice != null && (
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(promo.promoPrice)}
                    </span>
                  )}
                  {promo.originalPrice != null && promo.originalPrice !== promo.promoPrice && (
                    <span className="text-lg text-gray-400 line-through">
                      {formatCurrency(promo.originalPrice)}
                    </span>
                  )}
                  {promo.discount != null && promo.discount > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">
                      -{formatDiscount(promo.discount)}
                    </span>
                  )}
                </div>

                {/* Affiliate link */}
                {promo.affiliateUrl && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-0.5">Link de afiliado</p>
                      <p className="text-sm text-indigo-600 truncate font-mono">
                        {promo.affiliateUrl}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                      {copied ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      )}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                )}

                {/* Product URL */}
                {promo.productUrl && (
                  <div className="mt-3">
                    <a
                      href={promo.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-indigo-500 transition-colors inline-flex items-center gap-1"
                    >
                      Ver produto original
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Copy variations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Variações de Copy
                </h2>
                <p className="text-sm text-gray-500">
                  Clique em uma variação para selecioná-la
                </p>
              </div>
            </div>

            {promo.variations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">
                  Nenhuma variação de copy gerada ainda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {promo.variations.map((variation) => (
                  <CopyVariationCard
                    key={variation.id}
                    variation={variation}
                    isSelected={promo.selectedVariationId === variation.id}
                    onSelect={handleSelectVariation}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Preview sidebar */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
                Preview WhatsApp
              </h3>
              <WhatsAppPreview promo={promo} />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Excluir promo"
      >
        <p className="text-sm text-gray-600 mb-6">
          Tem certeza que deseja excluir <strong>{promo.productName}</strong>?
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
