import { Skeleton } from '@/components/ui/Skeleton';

export default function NewPromoLoading() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="max-w-2xl bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
