'use client';

import { useState } from 'react';
import type { CopyVariation } from '@/types';
import { TONE_LABELS } from '@/types';
import { Button } from '@/components/ui/Button';

interface CopyVariationCardProps {
  variation: CopyVariation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  maxChars?: number;
}

export function CopyVariationCard({
  variation,
  isSelected,
  onSelect,
  maxChars = 500,
}: CopyVariationCardProps) {
  const [copied, setCopied] = useState(false);
  const charCount = variation.content.length;
  const charPercentage = Math.min((charCount / maxChars) * 100, 100);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(variation.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={`
        relative rounded-xl border-2 p-5 transition-all duration-200
        ${isSelected
          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
          Selecionada
        </div>
      )}

      {/* Tone label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {TONE_LABELS[variation.tone] || variation.tone}
        </span>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
          aria-label="Copiar texto"
          title="Copiar texto"
        >
          {copied ? (
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          )}
        </button>
      </div>

      {/* Copy text */}
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-4">
        {variation.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Char count */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                charPercentage > 90 ? 'bg-red-500' : charPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${charPercentage}%` }}
            />
          </div>
          <span className={`text-xs ${charPercentage > 90 ? 'text-red-500' : 'text-gray-400'}`}>
            {charCount}/{maxChars}
          </span>
        </div>

        {/* Select button */}
        {!isSelected ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(variation.id);
            }}
          >
            Selecionar
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Selecionada</span>
          </div>
        )}
      </div>
    </div>
  );
}
