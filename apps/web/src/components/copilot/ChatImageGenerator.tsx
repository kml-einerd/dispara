'use client';

import { useState } from 'react';
import { Product } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { api } from '@/src/lib/api';
import { Image, Loader2, Check, Paintbrush, Sparkles, Zap, Instagram, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

interface ChatImageGeneratorProps {
  product: Product;
  promoText: string;
  onImageReady: (imageUrl: string) => void;
}

const STYLES = [
  { key: 'clean',  label: 'Clean',  desc: 'Fundo limpo, produto em destaque', icon: Sparkles },
  { key: 'bold',   label: 'Bold',   desc: 'Cores vibrantes, preço grande',    icon: Zap },
  { key: 'social', label: 'Social', desc: 'Formato stories/feed otimizado',   icon: Instagram },
] as const;

type ImageStyle = typeof STYLES[number]['key'];

export function ChatImageGenerator({ product, promoText, onImageReady }: ChatImageGeneratorProps) {
  const [style, setStyle] = useState<ImageStyle>('clean');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/promos/generate-image', {
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        promoPrice: product.promoPrice,
        originalPrice: product.originalPrice,
        discountPercent: product.discountPercent,
        promoText,
        style,
      });
      setGeneratedUrl(res.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    }
    setLoading(false);
  };

  const handleRegenerate = () => {
    setGeneratedUrl(null);
    handleGenerate();
  };

  const handleChangeStyle = () => {
    setGeneratedUrl(null);
  };

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <Paintbrush className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Gerar imagem para a promo</span>
      </div>

      {/* generated image preview */}
      {generatedUrl && !loading ? (
        <div className="space-y-3 p-3">
          <div className="overflow-hidden rounded-lg border border-border/30">
            <img
              src={generatedUrl}
              alt={`Promo ${product.name}`}
              className="w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Gerar outra
            </Button>
            <Button variant="outline" size="sm" onClick={handleChangeStyle} className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              Trocar estilo
            </Button>
            <Button size="sm" onClick={() => onImageReady(generatedUrl)} className="gap-1.5">
              <Check className="h-3 w-3" />
              Usar no disparo
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* loading skeleton */}
          {loading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-48 w-full rounded-lg" />
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Gerando imagem no estilo {STYLES.find(s => s.key === style)?.label}...
              </div>
            </div>
          ) : (
            <>
              {/* style selector */}
              <div className="grid grid-cols-3 gap-2 p-3">
                {STYLES.map(s => {
                  const Icon = s.icon;
                  const isSelected = style === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStyle(s.key)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{s.label}</span>
                      <span className="text-[10px] leading-tight opacity-70">{s.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* error */}
              {error && (
                <div className="px-3 pb-2">
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* generate button */}
              <div className="border-t border-border/50 p-3">
                <Button
                  onClick={handleGenerate}
                  className="w-full gap-2"
                >
                  <Image className="h-4 w-4" />
                  Gerar Imagem
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
