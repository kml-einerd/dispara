'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-medium text-gray-700">{start}</span> a{' '}
        <span className="font-medium text-gray-700">{end}</span> de{' '}
        <span className="font-medium text-gray-700">{total}</span> resultado{total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="
            inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg
            border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
          "
          aria-label="Página anterior"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Anterior
        </button>
        <span className="text-sm text-gray-500 px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="
            inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg
            border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
          "
          aria-label="Próxima página"
        >
          Próxima
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
