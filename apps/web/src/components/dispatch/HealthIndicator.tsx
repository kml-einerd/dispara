interface HealthIndicatorProps {
  score: number;
  size?: 'sm' | 'md';
}

export function HealthIndicator({ score, size = 'md' }: HealthIndicatorProps) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 70 ? 'text-emerald-700' : score >= 40 ? 'text-amber-700' : 'text-red-700';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${dotSize} rounded-full ${color}`} />
      <span className={`${textSize} font-medium ${textColor}`}>{score}%</span>
    </div>
  );
}
