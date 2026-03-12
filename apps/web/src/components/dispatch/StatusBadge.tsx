import { Badge } from '@/components/ui/Badge';
import type { DispatchStatus, DispatchItemStatus, WaSessionStatus } from '@/types';
import {
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_VARIANTS,
  DISPATCH_ITEM_STATUS_VARIANTS,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_VARIANTS,
} from '@/types';

interface DispatchStatusBadgeProps {
  status: DispatchStatus;
}

export function DispatchStatusBadge({ status }: DispatchStatusBadgeProps) {
  return (
    <Badge variant={DISPATCH_STATUS_VARIANTS[status]}>
      {DISPATCH_STATUS_LABELS[status]}
    </Badge>
  );
}

interface ItemStatusBadgeProps {
  status: DispatchItemStatus;
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  const labels: Record<DispatchItemStatus, string> = {
    PENDING: 'Pendente',
    QUEUED: 'Na Fila',
    SENT: 'Enviado',
    FAILED: 'Falhou',
    CANCELLED: 'Cancelado',
  };

  return (
    <Badge variant={DISPATCH_ITEM_STATUS_VARIANTS[status]}>
      {labels[status]}
    </Badge>
  );
}

interface SessionStatusBadgeProps {
  status: WaSessionStatus;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  return (
    <Badge variant={SESSION_STATUS_VARIANTS[status]}>
      {SESSION_STATUS_LABELS[status]}
    </Badge>
  );
}
