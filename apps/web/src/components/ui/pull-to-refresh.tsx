import { ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { usePullToRefresh } from '@/src/hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { containerRef, pullDistance, refreshing } = usePullToRefresh(onRefresh);

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden transition-opacity"
        style={{
          height: pullDistance,
          opacity: Math.min(pullDistance / 60, 1),
        }}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className="h-5 w-5 text-muted-foreground transition-transform"
            style={{ transform: `rotate(${pullDistance >= 80 ? 180 : 0}deg)` }}
          />
        )}
      </div>

      {/* Content with offset */}
      <div
        className="transition-transform"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
