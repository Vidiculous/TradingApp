export const DashboardSkeleton = () => {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Column Skeleton */}
      <div className="space-y-6 lg:col-span-8">
        {/* Header Skeleton */}
        <div className="h-[200px] rounded-3xl border border-white/5 bg-white/5" />

        {/* Chart Skeleton */}
        <div className="h-[500px] rounded-3xl border border-white/5 bg-white/5" />

        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-white/5 bg-white/5" />
          ))}
        </div>
      </div>

      {/* Right Column Skeleton */}
      <div className="flex flex-col space-y-6 lg:col-span-4">
        {/* AI Card Skeleton */}
        <div className="h-[200px] rounded-3xl border border-white/5 bg-white/5" />

        {/* News Skeleton */}
        <div className="min-h-[400px] flex-1 rounded-3xl border border-white/5 bg-white/5" />
      </div>
    </div>
  );
};
