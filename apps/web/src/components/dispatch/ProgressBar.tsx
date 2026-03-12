interface ProgressBarProps {
  sent: number;
  failed: number;
  total: number;
  showLabels?: boolean;
}

export function ProgressBar({ sent, failed, total, showLabels = true }: ProgressBarProps) {
  const sentPct = total > 0 ? (sent / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;
  const pending = total - sent - failed;

  return (
    <div className="space-y-1.5">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        {sentPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${sentPct}%` }}
          />
        )}
        {failedPct > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${failedPct}%` }}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {sent} enviados
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {failed} falhou
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-200" />
              {pending} pendentes
            </span>
          )}
        </div>
      )}
    </div>
  );
}
