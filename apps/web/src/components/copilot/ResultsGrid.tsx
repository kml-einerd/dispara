'use client';

import { Product } from "@/src/types";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/src/lib/utils";
import { Button } from "../ui/button";

interface ResultsGridProps {
  products: Product[];
  isLoading: boolean;
  onSelect: (product: Product) => void;
  selectedId?: string;
}

export function ResultsGrid({ products, isLoading, onSelect, selectedId }: ResultsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[200px] w-full rounded-xl sm:h-[240px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {products.map((product) => (
        <Card 
          key={product.id} 
          className={cn(
            "group relative cursor-pointer overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary",
            selectedId === product.id && "border-primary ring-1 ring-primary"
          )}
          onClick={() => onSelect(product)}
        >
          <div className="aspect-square overflow-hidden">
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="h-full w-full object-cover transition-transform group-hover:scale-105" 
            />
            <Badge 
              className={cn(
                "absolute left-2 top-2",
                product.marketplace === 'SHOPEE' ? "bg-violet-600" : "bg-yellow-500 text-black"
              )}
            >
              {product.marketplace}
            </Badge>
            <Badge variant="destructive" className="absolute right-2 top-2">
              {product.discountPercent}% OFF
            </Badge>
          </div>
          <CardContent className="p-3">
            <h4 className="line-clamp-2 text-xs font-medium leading-tight">{product.name}</h4>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-emerald-500">R$ {product.promoPrice.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground line-through">R$ {product.originalPrice.toFixed(2)}</span>
            </div>
          </CardContent>
          
          <div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center p-2 transition-transform group-hover:translate-y-0">
            <Button size="sm" className="w-full h-8 text-xs">Selecionar</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
