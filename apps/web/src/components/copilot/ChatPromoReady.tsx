'use client';

import { useState } from 'react';
import { Product } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { Copy, Check, Rocket, Image } from 'lucide-react';
import { Button } from '../ui/button';

interface ChatPromoReadyProps {
  product: Product;
  variations: Record<string, string>;
  onDispatch: (variation: string) => void;
  onGenerateImage?: (promoText: string) => void;
}

const TABS = [
  { key: 'urgente',  label: '🔥 Urgente'  },
  { key: 'casual',   label: '😎 Casual'   },
  { key: 'formal',   label: '📢 Formal'   },
  { key: 'divertido',label: '🤪 Divertido'},
  { key: 'escassez', label: '⏳ Escassez' },
];

export function ChatPromoReady({ product, variations, onDispatch, onGenerateImage }: ChatPromoReadyProps) {
  const [active, setActive] = useState('urgente');
  const [copied, setCopied] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>(variations);

  const handleCopy = () => {
    navigator.clipboard.writeText(edited[active] ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      {/* product strip */}
      <div className="flex items-center gap-3 border-b border-border/50 p-3">
        <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-400">R$ {product.promoPrice.toFixed(2)}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
              Link inserido ✓
            </span>
          </div>
        </div>
      </div>

      {/* tone tabs */}
      <div className="flex overflow-x-auto border-b border-border/50 scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'shrink-0 px-3 py-2 text-[11px] font-medium transition-colors',
              active === t.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* copy textarea */}
      <div className="relative p-3">
        <textarea
          value={edited[active] ?? ''}
          onChange={e => setEdited({ ...edited, [active]: e.target.value })}
          rows={6}
          className="w-full resize-none rounded-lg bg-secondary/40 p-3 text-xs leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleCopy}
          className="absolute right-5 top-5 rounded-md bg-secondary p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* action buttons */}
      <div className="flex gap-2 border-t border-border/50 p-3">
        {onGenerateImage && (
          <Button
            variant="outline"
            onClick={() => onGenerateImage(edited[active] ?? '')}
            className="flex-1 gap-2"
          >
            <Image className="h-4 w-4" />
            Gerar Imagem
          </Button>
        )}
        <Button
          onClick={() => onDispatch(edited[active] ?? '')}
          className="flex-1 gap-2"
        >
          <Rocket className="h-4 w-4" />
          Disparar
        </Button>
      </div>
    </div>
  );
}
