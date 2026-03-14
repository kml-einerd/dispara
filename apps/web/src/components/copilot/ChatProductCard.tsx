'use client';

import { Product } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ChatProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function ChatProductCard({ product, onSelect }: ChatProductCardProps) {
  return (
    <button
      onClick={() => onSelect(product)}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border border-border/50 bg-card/50 text-left',
        'transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10',
      )}
    >
      {/* imagem */}
      <div className="aspect-square overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>

      {/* badges */}
      <span className={cn(
        'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white',
        product.marketplace === 'SHOPEE' ? 'bg-violet-600' : 'bg-yellow-500 text-black',
      )}>
        {product.marketplace === 'SHOPEE' ? 'Shopee' : 'ML'}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
        -{product.discountPercent}%
      </span>

      {/* info */}
      <div className="p-2">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight">{product.name}</p>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-sm font-bold text-emerald-400">
            R$ {product.promoPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground line-through">
            R$ {product.originalPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-primary/80 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-primary">
          Gerar anúncio →
        </span>
      </div>
    </button>
  );
}
