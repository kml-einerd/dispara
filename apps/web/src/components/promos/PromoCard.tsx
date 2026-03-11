'use client';

import { useRouter } from 'next/navigation';
import type { Promo } from '@/types';
import { MARKETPLACE_LABELS, MARKETPLACE_COLORS, STATUS_LABELS, STATUS_COLORS } from '@/types';
import { formatCurrency, formatDiscount, formatRelativeDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

interface PromoCardProps {
  promo: Promo;
}

export function PromoCard({ promo }: PromoCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/promos/${promo.id}`)}
      className="
        bg-white rounded-xl border border-gray-200 p-4
        hover:border-gray-300 hover:shadow-sm transition-all duration-150
        text-left w-full group
      "
    >
      <div className="flex gap-4">
        {/* Product image */}
        <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
          {promo.imageUrl ? (
            <img
              src={promo.imageUrl}
              alt={promo.productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {promo.productName}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            {promo.marketplace && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${MARKETPLACE_COLORS[promo.marketplace]}`}>
                {MARKETPLACE_LABELS[promo.marketplace]}
              </span>
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[promo.status]}`}>
              {STATUS_LABELS[promo.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {promo.promoPrice != null && (
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(promo.promoPrice)}
              </span>
            )}
            {promo.originalPrice != null && promo.originalPrice !== promo.promoPrice && (
              <span className="text-xs text-gray-400 line-through">
                {formatCurrency(promo.originalPrice)}
              </span>
            )}
            {promo.discount != null && promo.discount > 0 && (
              <Badge variant="success">-{formatDiscount(promo.discount)}</Badge>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-gray-400">{formatRelativeDate(promo.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
