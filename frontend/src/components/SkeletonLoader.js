import React from "react";

// Base skeleton components
export function SkeletonBox({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] rounded-lg ${className}`} 
         style={{ animation: 'shimmer 2s infinite linear' }} />
  );
}

export function SkeletonCircle({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] rounded-full ${className}`}
         style={{ animation: 'shimmer 2s infinite linear' }} />
  );
}

export function SkeletonText({ className = "" }) {
  return <SkeletonBox className={`h-4 ${className}`} />;
}

// Feed Page Skeleton
export function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        
        {/* Main Feed Column */}
        <div className="flex-1 min-w-0 w-full max-w-[720px] mx-auto lg:mx-0">
          
          {/* Stories Skeleton */}
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                <SkeletonCircle className="w-16 h-16" />
                <SkeletonText className="w-12 h-3" />
              </div>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <div className="flex items-center gap-8 border-b border-border/40 pb-2 mb-6">
            <SkeletonText className="w-16 h-4" />
            <SkeletonText className="w-20 h-4" />
          </div>

          {/* Post Composer Skeleton */}
          <div className="mb-6 p-6 rounded-[24px] bg-card border border-border/40 shadow-sm">
            <div className="flex items-center gap-4">
              <SkeletonCircle className="h-10 w-10" />
              <SkeletonText className="flex-1 h-10" />
            </div>
          </div>

          {/* Posts Skeleton */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-4 bg-card rounded-[24px] border border-border/40 shadow-sm">
              {/* Post Header */}
              <div className="p-6 flex items-center gap-4">
                <SkeletonCircle className="h-10 w-10" />
                <div className="flex-1">
                  <SkeletonText className="w-32 h-4 mb-2" />
                  <SkeletonText className="w-24 h-3" />
                </div>
              </div>
              
              {/* Post Content */}
              <div className="px-6 pb-4 space-y-2">
                <SkeletonText className="w-full h-4" />
                <SkeletonText className="w-3/4 h-4" />
              </div>

              {/* Post Image */}
              <div className="px-6 pb-4">
                <SkeletonBox className="w-full h-64 rounded-2xl" />
              </div>

              {/* Post Actions */}
              <div className="px-6 py-4 flex items-center gap-6 border-t border-border/30">
                <SkeletonText className="w-12 h-4" />
                <SkeletonText className="w-12 h-4" />
                <SkeletonText className="w-12 h-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Right Sidebar Skeleton */}
        <aside className="hidden lg:flex w-[320px] flex-shrink-0 flex-col gap-6">
          {/* Performance Stats Widget */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <SkeletonText className="w-32 h-4" />
              <SkeletonBox className="w-20 h-6 rounded-full" />
            </div>
            <div className="space-y-4">
              <SkeletonBox className="w-full h-20 rounded-2xl" />
              <div className="flex gap-4">
                <SkeletonBox className="flex-1 h-20 rounded-2xl" />
                <SkeletonBox className="flex-1 h-20 rounded-2xl" />
              </div>
            </div>
          </div>

          {/* Suggested Follows Widget */}
          <div className="p-6">
            <SkeletonText className="w-32 h-4 mb-6" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SkeletonCircle className="w-10 h-10" />
                    <div>
                      <SkeletonText className="w-24 h-3 mb-2" />
                      <SkeletonText className="w-16 h-2" />
                    </div>
                  </div>
                  <SkeletonBox className="w-16 h-6 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Admin Dashboard Skeleton
export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        
        {/* Page Header Skeleton */}
        <div className="mb-8">
          <SkeletonText className="w-48 h-8 mb-2" />
          <SkeletonText className="w-64 h-4" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex items-center gap-8 border-b border-border mb-8 pb-3">
          <SkeletonText className="w-20 h-4" />
          <SkeletonText className="w-16 h-4" />
          <SkeletonText className="w-20 h-4" />
          <SkeletonText className="w-20 h-4" />
        </div>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <SkeletonText className="w-24 h-3" />
                <SkeletonBox className="w-8 h-8 rounded-xl" />
              </div>
              <SkeletonText className="w-20 h-8 mb-2" />
              <SkeletonText className="w-16 h-3" />
            </div>
          ))}
        </div>

        {/* Recent Registrations Skeleton */}
        <div>
          <SkeletonText className="w-40 h-4 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-5 border border-border/40 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SkeletonCircle className="h-11 w-11" />
                  <div>
                    <SkeletonText className="w-32 h-4 mb-2" />
                    <SkeletonText className="w-48 h-3" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SkeletonBox className="w-20 h-6 rounded-md" />
                  <SkeletonBox className="w-16 h-6 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// IoT Dashboard Skeleton
export function IoTSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        
        {/* Page Header Skeleton */}
        <div className="mb-8">
          <SkeletonText className="w-40 h-8 mb-2" />
          <SkeletonText className="w-56 h-4" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <SkeletonText className="w-28 h-3" />
                <SkeletonBox className="w-8 h-8 rounded-xl" />
              </div>
              <SkeletonText className="w-16 h-8" />
            </div>
          ))}
        </div>

        {/* Devices Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <SkeletonBox className="w-10 h-10 rounded-xl" />
                  <div>
                    <SkeletonText className="w-24 h-4 mb-2" />
                    <SkeletonText className="w-16 h-3" />
                  </div>
                </div>
                <SkeletonBox className="w-12 h-6 rounded-full" />
              </div>
              <div className="space-y-2">
                <SkeletonText className="w-full h-3" />
                <SkeletonText className="w-3/4 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Add shimmer animation to global CSS
export const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
`;
