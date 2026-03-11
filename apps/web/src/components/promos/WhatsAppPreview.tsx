'use client';

import type { PromoWithVariations } from '@/types';

interface WhatsAppPreviewProps {
  promo: PromoWithVariations;
}

export function WhatsAppPreview({ promo }: WhatsAppPreviewProps) {
  const selectedVariation = promo.variations.find(
    (v) => v.id === promo.selectedVariationId,
  );
  const copyText = promo.selectedCopy || selectedVariation?.content || promo.variations[0]?.content || '';

  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-sm mx-auto">
      {/* WhatsApp header */}
      <div className="bg-[#075e54] text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#128c7e] flex items-center justify-center text-xs font-bold">
          GP
        </div>
        <div>
          <p className="text-sm font-medium">Grupo de Promos</p>
          <p className="text-[10px] opacity-70">Você, +55 11 9...</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="bg-[#ece5dd] px-3 py-4 min-h-[300px] rounded-b-xl"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c6bba5' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {/* Message bubble */}
        <div className="max-w-[85%] ml-auto">
          <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none shadow-sm overflow-hidden">
            {/* Image */}
            {promo.imageUrl && (
              <div className="w-full aspect-square bg-gray-200 overflow-hidden">
                <img
                  src={promo.imageUrl}
                  alt={promo.productName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Text content */}
            <div className="px-3 py-2">
              <p className="text-[13px] text-gray-900 whitespace-pre-wrap leading-[1.4]">
                {copyText}
              </p>

              {/* Link */}
              {promo.affiliateUrl && (
                <p className="text-[13px] text-blue-600 mt-2 break-all">
                  {promo.affiliateUrl}
                </p>
              )}

              {/* Timestamp */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[11px] text-gray-500">{time}</span>
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 15" fill="currentColor">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.033l-.378.456a.32.32 0 0 0 .036.46l1.08.984c.14.128.35.12.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.9a.366.366 0 0 0-.51.065l-.38.459a.365.365 0 0 0 .063.51l3.098 2.826c.14.128.35.12.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
