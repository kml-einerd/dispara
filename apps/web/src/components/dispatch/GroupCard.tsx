'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { WaGroup } from '@/types';

interface GroupCardProps {
  group: WaGroup;
  onToggleActive: (id: string, isActive: boolean) => void;
  toggling?: boolean;
}

export function GroupCard({ group, onToggleActive, toggling }: GroupCardProps) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{group.memberCount} membros</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">{group._count.dispatchItems} disparos</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">{group.session.phoneNumber}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={group.isActive ? 'success' : 'default'}>
          {group.isActive ? 'Ativo' : 'Inativo'}
        </Badge>
        <button
          onClick={() => onToggleActive(group.id, !group.isActive)}
          disabled={toggling}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${group.isActive ? 'bg-indigo-500' : 'bg-gray-200'}
          `}
          role="switch"
          aria-checked={group.isActive}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
              transition duration-200 ease-in-out
              ${group.isActive ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
    </Card>
  );
}
