'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Product, Group } from '@/src/types';
import { Button } from '../ui/button';
import { CheckSquare, Square, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { DispatchScheduler } from '../dispatch/DispatchScheduler';

interface ChatDispatchConfirmProps {
  product: Product;
  variation: string;
}

export function ChatDispatchConfirm({ product, variation }: ChatDispatchConfirmProps) {
  const { data: groupsData, isLoading: groupsLoading } = useSWR('/groups');
  const groups: Group[] = groupsData?.data || [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // Auto-select active groups once loaded
  if (!initialized && groups.length > 0) {
    setSelected(new Set(groups.filter(g => g.isActive).map(g => g.id)));
    setInitialized(true);
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { api } = await import('@/src/lib/api');
      await api.post('/dispatches', {
        promoId: product.id,
        groupIds: Array.from(selected),
        scheduledAt,
      });
      setSent(true);
    } catch (error) {
      console.error('Dispatch failed', error);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
        <div>
          <p className="font-semibold text-emerald-400">Disparo confirmado!</p>
          <p className="text-xs text-muted-foreground">
            {selected.size} grupo(s) · {product.name.slice(0, 30)}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      {/* header */}
      <div className="border-b border-border/50 p-3">
        <p className="text-sm font-semibold">Selecione os grupos</p>
        <p className="text-xs text-muted-foreground">{selected.size} de {groups.length} selecionados</p>
      </div>

      {/* groups */}
      <div className="divide-y divide-border/30">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => toggle(g.id)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40',
              !g.isActive && 'opacity-40',
            )}
            disabled={!g.isActive}
          >
            {selected.has(g.id)
              ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
              : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
            }
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{g.name}</p>
              <p className="text-xs text-muted-foreground">{g.memberCount} membros</p>
            </div>
            {!g.isActive && (
              <span className="text-[10px] text-muted-foreground">Inativo</span>
            )}
          </button>
        ))}
      </div>

      {/* preview copy */}
      <div className="border-t border-border/50 bg-secondary/20 px-3 py-2">
        <p className="text-[10px] text-muted-foreground mb-1">Preview da mensagem:</p>
        <p className="line-clamp-2 text-[11px] text-foreground/80">{variation}</p>
      </div>

      {/* scheduler */}
      <div className="border-t border-border/50 p-3">
        <DispatchScheduler value={scheduledAt} onChange={setScheduledAt} />
      </div>

      {/* confirm */}
      <div className="border-t border-border/50 p-3">
        <Button
          onClick={handleSend}
          disabled={selected.size === 0 || sending}
          className="w-full gap-2"
        >
          {sending
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Enviando...</>
            : <><Send className="h-4 w-4" />{scheduledAt ? 'Agendar' : 'Disparar para'} {selected.size} grupo(s)</>
          }
        </Button>
      </div>
    </div>
  );
}
