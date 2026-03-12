'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCreatePromo } from '@/hooks/usePromos';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CopyVariationCard } from '@/components/promos/CopyVariationCard';
import type { PromoWithVariations, Marketplace } from '@/types';
import { MARKETPLACE_LABELS } from '@/types';
import { formatCurrency, formatDiscount } from '@/lib/format';
import { api } from '@/lib/api';

type InputMode = 'url' | 'keyword';

const MARKETPLACE_OPTIONS = [
  { value: 'SHOPEE', label: 'Shopee' },
  { value: 'AMAZON', label: 'Amazon' },
  { value: 'MERCADOLIVRE', label: 'Mercado Livre' },
  { value: 'MAGALU', label: 'Magazine Luiza' },
  { value: 'ALIEXPRESS', label: 'AliExpress' },
];

export default function NewPromoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { mutate: createPromo, loading: creating } = useCreatePromo();

  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [marketplace, setMarketplace] = useState<Marketplace | ''>('');
  const [urlError, setUrlError] = useState('');
  const [keywordError, setKeywordError] = useState('');

  const [result, setResult] = useState<PromoWithVariations | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validateUrl = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerate = async () => {
    // Validate
    if (inputMode === 'url') {
      if (!url.trim()) {
        setUrlError('Cole a URL do produto');
        return;
      }
      if (!validateUrl(url.trim())) {
        setUrlError('URL inválida. Cole o link completo do produto.');
        return;
      }
      setUrlError('');
    } else {
      if (!keyword.trim()) {
        setKeywordError('Digite uma palavra-chave');
        return;
      }
      if (!marketplace) {
        setKeywordError('Selecione um marketplace');
        return;
      }
      setKeywordError('');
    }

    try {
      const payload =
        inputMode === 'url'
          ? { url: url.trim() }
          : { keyword: keyword.trim(), marketplace: marketplace as Marketplace };

      const promo = await createPromo(payload);
      setResult(promo);

      // Pre-select first variation
      if (promo.variations.length > 0) {
        setSelectedVariationId(promo.variations[0].id);
      }

      toast('success', 'Promo gerada com sucesso!');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erro ao gerar promo');
    }
  };

  const handleSave = async () => {
    if (!result || !selectedVariationId) return;

    setSaving(true);
    try {
      const selectedVar = result.variations.find((v) => v.id === selectedVariationId);
      await api.updatePromo(result.id, {
        selectedVariationId,
        selectedCopy: selectedVar?.content,
      });
      toast('success', 'Promo salva com sucesso!');
      router.push(`/promos/${result.id}`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erro ao salvar promo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/promos"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Promo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cole a URL de um produto ou busque por palavra-chave
          </p>
        </div>
      </div>

      {/* Input section */}
      {!result && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Mode toggle */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setInputMode('url')}
                className={`
                  flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all
                  ${inputMode === 'url'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                Por URL
              </button>
              <button
                onClick={() => setInputMode('keyword')}
                className={`
                  flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all
                  ${inputMode === 'keyword'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                Por Palavra-chave
              </button>
            </div>

            {inputMode === 'url' ? (
              <div className="space-y-4">
                <Input
                  label="URL do Produto"
                  placeholder="https://www.shopee.com.br/produto-exemplo..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError('');
                  }}
                  error={urlError}
                  helperText="Suportamos Shopee, Amazon, Mercado Livre, Magalu e AliExpress"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Palavra-chave"
                  placeholder="Ex: fone bluetooth, air fryer, smartphone..."
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    if (keywordError) setKeywordError('');
                  }}
                  error={keywordError}
                />
                <Select
                  label="Marketplace"
                  options={MARKETPLACE_OPTIONS}
                  placeholder="Selecione o marketplace"
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value as Marketplace | '')}
                />
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={handleGenerate}
                loading={creating}
                disabled={creating}
                size="lg"
                className="w-full"
              >
                {creating ? (
                  'Gerando promo...'
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                    Gerar Promo
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Loading progress */}
          {creating && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48">
                    <circle className="opacity-20" cx="24" cy="24" r="20" stroke="#6366f1" strokeWidth="4" fill="none" />
                    <circle className="opacity-80" cx="24" cy="24" r="20" stroke="#6366f1" strokeWidth="4" fill="none"
                      strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Processando...</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Extraindo dados do produto e gerando variações de copy com IA
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <ProgressStep label="Acessando produto" done />
                <ProgressStep label="Extraindo informações" done />
                <ProgressStep label="Gerando link de afiliado" active />
                <ProgressStep label="Criando variações de copy" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result section */}
      {result && (
        <div className="space-y-6">
          {/* Product info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Product image */}
              <div className="w-32 h-32 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt={result.productName}
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

              {/* Product details */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {result.productName}
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.marketplace && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {MARKETPLACE_LABELS[result.marketplace]}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  {result.promoPrice != null && (
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(result.promoPrice)}
                    </span>
                  )}
                  {result.originalPrice != null && result.originalPrice !== result.promoPrice && (
                    <span className="text-base text-gray-400 line-through">
                      {formatCurrency(result.originalPrice)}
                    </span>
                  )}
                  {result.discount != null && result.discount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">
                      -{formatDiscount(result.discount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Variations */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Variações de Copy
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Selecione a variação que melhor se encaixa no seu estilo
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {result.variations.map((variation) => (
                <CopyVariationCard
                  key={variation.id}
                  variation={variation}
                  isSelected={selectedVariationId === variation.id}
                  onSelect={setSelectedVariationId}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setSelectedVariationId(null);
              }}
            >
              Gerar outra
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!selectedVariationId || saving}
              size="lg"
            >
              Salvar Promo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function ProgressStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : active ? (
        <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
      )}
      <span className={`text-sm ${done ? 'text-emerald-600' : active ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}
