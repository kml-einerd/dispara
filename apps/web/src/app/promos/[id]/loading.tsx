import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function PromoDetailLoading() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex gap-6">
            <Skeleton className="w-32 h-32 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <SkeletonText lines={5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
