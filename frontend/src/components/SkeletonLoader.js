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

// Admin Users Tab Skeleton
export function AdminUsersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <SkeletonBox key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <div className="bg-card border border-border/40 rounded-2xl sm:rounded-[28px] p-1.5 sm:p-2 shadow-sm">
        <div className="divide-y divide-border/30">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <SkeletonCircle className="h-10 w-10" />
                <div>
                  <SkeletonText className="w-28 h-4 mb-2" />
                  <SkeletonText className="w-40 h-3" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SkeletonBox className="w-16 h-6 rounded-full" />
                <SkeletonBox className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Venues Tab Skeleton
export function AdminVenuesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonText className="w-24 h-5 mb-1" />
          <SkeletonText className="w-16 h-3" />
        </div>
        <SkeletonBox className="w-28 h-10 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBox className="h-14 w-14 rounded-xl" />
              <div>
                <SkeletonText className="w-36 h-4 mb-2" />
                <SkeletonText className="w-48 h-3 mb-1" />
                <SkeletonText className="w-24 h-3" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-16 h-6 rounded-full" />
              <SkeletonBox className="w-8 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin Settings Tab Skeleton
export function AdminSettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 p-1.5 rounded-2xl w-fit border border-border/40">
        {[...Array(5)].map((_, i) => (
          <SkeletonBox key={i} className="h-10 w-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
            <SkeletonText className="w-32 h-4 mb-4" />
            <div className="space-y-3">
              <SkeletonBox className="w-full h-10 rounded-xl" />
              <SkeletonBox className="w-full h-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin Payouts Tab Skeleton
export function AdminPayoutsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
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
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <SkeletonBox key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 border-b border-border/20">
            <div className="flex items-center gap-3">
              <div>
                <SkeletonText className="w-28 h-4 mb-2" />
                <SkeletonText className="w-20 h-3" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SkeletonText className="w-20 h-4" />
              <SkeletonBox className="w-20 h-8 rounded-lg" />
            </div>
          </div>
        ))}
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

// Player Dashboard Skeleton
export function PlayerDashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 pb-20 md:pb-6">
      {/* Welcome Hero Skeleton */}
      <div className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-3 gap-0">
          <div className="md:col-span-2 p-4 sm:p-7 md:p-10">
            <SkeletonText className="w-20 h-3 mb-2" />
            <SkeletonText className="w-64 h-8 mb-2" />
            <SkeletonText className="w-full max-w-md h-4 mb-6" />
            <div className="flex items-center gap-3 flex-wrap">
              <SkeletonBox className="w-32 h-12 rounded-xl" />
              <SkeletonBox className="w-40 h-12 rounded-xl" />
            </div>
          </div>
          <div className="hidden md:block relative h-full min-h-[220px]">
            <SkeletonBox className="w-full h-full" />
          </div>
        </div>
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-10">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-[28px] p-4 sm:p-6 border border-border/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <SkeletonText className="w-20 h-3" />
              <SkeletonBox className="w-10 h-10 rounded-2xl" />
            </div>
            <SkeletonText className="w-16 h-8" />
          </div>
        ))}
      </div>

      {/* Quick Search Skeleton */}
      <div className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm p-6">
        <SkeletonText className="w-24 h-3 mb-4" />
        <div className="flex gap-3">
          <SkeletonBox className="flex-1 h-11 rounded-xl" />
          <SkeletonBox className="w-20 h-11 rounded-xl" />
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {[...Array(4)].map((_, i) => (
          <SkeletonBox key={i} className="h-40 rounded-[28px]" />
        ))}
      </div>

      {/* Upcoming Bookings Skeleton */}
      <div className="mb-10">
        <SkeletonText className="w-40 h-6 mb-5" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[28px] bg-card border border-border/40 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                  <SkeletonText className="w-48 h-4 mb-2" />
                  <SkeletonText className="w-24 h-3" />
                </div>
                <SkeletonBox className="w-20 h-6 rounded-full" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <SkeletonText className="w-24 h-4" />
                <SkeletonText className="w-32 h-4" />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/20">
                <SkeletonText className="w-20 h-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Venue Owner Dashboard Skeleton
export function VenueOwnerDashboardSkeleton() {
  return (
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
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <SkeletonText className="w-24 h-3" />
              <SkeletonBox className="w-10 h-10 rounded-2xl" />
            </div>
            <SkeletonText className="w-20 h-8" />
          </div>
        ))}
      </div>

      {/* Content Area Skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-5 border border-border/40 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <SkeletonCircle className="h-11 w-11" />
                <div className="flex-1">
                  <SkeletonText className="w-32 h-4 mb-2" />
                  <SkeletonText className="w-48 h-3" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SkeletonBox className="w-20 h-6 rounded-md" />
                <SkeletonBox className="w-16 h-6 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Coach Dashboard Skeleton
export function CoachDashboardSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      {/* Page Header Skeleton */}
      <div className="mb-8">
        <SkeletonText className="w-48 h-8 mb-2" />
        <SkeletonText className="w-64 h-4" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-8 border-b border-border mb-8 pb-3">
        <SkeletonText className="w-20 h-4" />
        <SkeletonText className="w-24 h-4" />
        <SkeletonText className="w-20 h-4" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <SkeletonText className="w-24 h-3" />
              <SkeletonBox className="w-10 h-10 rounded-2xl" />
            </div>
            <SkeletonText className="w-20 h-8" />
          </div>
        ))}
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <SkeletonCircle className="w-10 h-10" />
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
  );
}

// Tournaments Page Skeleton
export function TournamentsSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Skeleton */}
        <div className="mb-8">
          <SkeletonText className="w-48 h-8 mb-2" />
          <SkeletonText className="w-64 h-4" />
        </div>

        {/* Search and Filters Skeleton */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <SkeletonBox className="flex-1 h-11 rounded-xl" />
          <SkeletonBox className="w-32 h-11 rounded-xl" />
          <SkeletonBox className="w-32 h-11 rounded-xl" />
        </div>

        {/* Tournament Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-[28px] border border-border/40 shadow-sm overflow-hidden">
              <SkeletonBox className="w-full h-48" />
              <div className="p-6">
                <SkeletonText className="w-full h-5 mb-3" />
                <SkeletonText className="w-3/4 h-4 mb-4" />
                <div className="flex items-center justify-between">
                  <SkeletonText className="w-24 h-4" />
                  <SkeletonBox className="w-20 h-6 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Teams Page Skeleton
export function TeamsSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Skeleton */}
        <div className="mb-8">
          <SkeletonText className="w-40 h-8 mb-2" />
          <SkeletonText className="w-56 h-4" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex items-center gap-8 border-b border-border mb-6 pb-3">
          <SkeletonText className="w-20 h-4" />
          <SkeletonText className="w-24 h-4" />
        </div>

        {/* Search Skeleton */}
        <div className="mb-6">
          <SkeletonBox className="w-full max-w-md h-11 rounded-xl" />
        </div>

        {/* Team Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <SkeletonCircle className="w-12 h-12" />
                <div className="flex-1">
                  <SkeletonText className="w-32 h-4 mb-2" />
                  <SkeletonText className="w-24 h-3" />
                </div>
              </div>
              <div className="space-y-2">
                <SkeletonText className="w-full h-3" />
                <SkeletonText className="w-3/4 h-3" />
              </div>
              <div className="mt-4 pt-4 border-t border-border/20">
                <SkeletonBox className="w-full h-9 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Venue Discovery Skeleton
export function VenueDiscoverySkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar Skeleton */}
        <div className="mb-6">
          <SkeletonBox className="w-full h-12 rounded-xl" />
        </div>

        {/* Filters Skeleton */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <SkeletonBox key={i} className="w-24 h-9 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Venue Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-card rounded-[28px] border border-border/40 shadow-sm overflow-hidden">
              <SkeletonBox className="w-full h-48" />
              <div className="p-5">
                <SkeletonText className="w-full h-5 mb-2" />
                <SkeletonText className="w-3/4 h-4 mb-4" />
                <div className="flex items-center justify-between">
                  <SkeletonText className="w-20 h-4" />
                  <SkeletonBox className="w-16 h-6 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Notifications Page Skeleton
export function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header Skeleton */}
        <div className="mb-6">
          <SkeletonText className="w-40 h-8 mb-2" />
        </div>

        {/* Notification Items Skeleton */}
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
              <div className="flex items-start gap-4">
                <SkeletonCircle className="w-10 h-10 flex-shrink-0" />
                <div className="flex-1">
                  <SkeletonText className="w-full h-4 mb-2" />
                  <SkeletonText className="w-3/4 h-3 mb-2" />
                  <SkeletonText className="w-24 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Profile Page Skeleton
export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Profile Header Skeleton */}
        <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <SkeletonCircle className="w-24 h-24" />
            <div className="flex-1 text-center sm:text-left">
              <SkeletonText className="w-48 h-6 mb-2 mx-auto sm:mx-0" />
              <SkeletonText className="w-64 h-4 mb-4 mx-auto sm:mx-0" />
              <div className="flex gap-3 justify-center sm:justify-start">
                <SkeletonBox className="w-24 h-9 rounded-xl" />
                <SkeletonBox className="w-24 h-9 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm text-center">
              <SkeletonText className="w-16 h-8 mb-2 mx-auto" />
              <SkeletonText className="w-20 h-3 mx-auto" />
            </div>
          ))}
        </div>

        {/* Content Tabs Skeleton */}
        <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6">
          <div className="flex gap-6 border-b border-border/20 mb-6 pb-3">
            <SkeletonText className="w-20 h-4" />
            <SkeletonText className="w-24 h-4" />
            <SkeletonText className="w-20 h-4" />
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 bg-secondary/20 rounded-xl">
                <SkeletonText className="w-full h-4 mb-2" />
                <SkeletonText className="w-3/4 h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Matchmaking Page Skeleton
export function MatchmakingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Skeleton */}
        <div className="mb-8">
          <SkeletonText className="w-48 h-8 mb-2" />
          <SkeletonText className="w-64 h-4" />
        </div>

        {/* Filters Skeleton */}
        <div className="mb-6 flex gap-4">
          <SkeletonBox className="w-32 h-11 rounded-xl" />
          <SkeletonBox className="w-32 h-11 rounded-xl" />
          <SkeletonBox className="w-32 h-11 rounded-xl" />
        </div>

        {/* Match Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <SkeletonText className="w-32 h-5" />
                <SkeletonBox className="w-20 h-6 rounded-full" />
              </div>
              <div className="space-y-3 mb-4">
                <SkeletonText className="w-full h-4" />
                <SkeletonText className="w-3/4 h-4" />
              </div>
              <SkeletonBox className="w-full h-10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chat Page Skeleton
export function ChatSkeleton() {
  return (
    <div className="flex-1 flex w-full min-h-0 overflow-hidden bg-background md:bg-card/40 md:backdrop-blur-md md:rounded-[20px] lg:rounded-[28px] md:border border-border/30 pb-16 lg:pb-0 md:my-4">
      {/* Sidebar Skeleton */}
      <div className="w-full lg:w-[340px] xl:w-[380px] lg:border-r border-border/30 flex-shrink-0 flex flex-col bg-transparent">
        {/* Header */}
        <div className="p-4 border-b border-border/30">
          <div className="flex items-center justify-between mb-4">
            <SkeletonText className="w-24 h-6" />
            <div className="flex gap-2">
              <SkeletonBox className="w-9 h-9 rounded-xl" />
              <SkeletonBox className="w-9 h-9 rounded-xl" />
            </div>
          </div>
          {/* Search */}
          <SkeletonBox className="w-full h-10 rounded-xl" />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden p-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 mb-1 rounded-2xl">
              <SkeletonCircle className="w-12 h-12 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <SkeletonText className="w-32 h-4 mb-2" />
                <SkeletonText className="w-full h-3" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <SkeletonText className="w-12 h-3" />
                <SkeletonBox className="w-5 h-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="hidden lg:flex flex-1 min-w-0 flex-col items-center justify-center p-6 text-center">
        <SkeletonBox className="w-20 h-20 rounded-[32px] mb-6" />
        <SkeletonText className="w-48 h-6 mb-2" />
        <SkeletonText className="w-56 h-4 mb-8" />
        <div className="flex gap-3">
          <SkeletonBox className="w-32 h-11 rounded-2xl" />
          <SkeletonBox className="w-32 h-11 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// Coach Listing Page Skeleton
export function CoachListingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-5 sm:py-8 pb-16 md:pb-6">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <SkeletonText className="w-20 h-3 mb-2" />
            <SkeletonText className="w-48 h-8" />
          </div>
          <SkeletonBox className="w-full sm:w-40 h-11 rounded-xl" />
        </div>
        <SkeletonText className="w-96 h-4" />
      </div>

      {/* Search and Filters Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SkeletonBox className="flex-1 h-11 rounded-xl" />
        <SkeletonBox className="w-full sm:w-40 h-11 rounded-xl" />
      </div>

      {/* Coach Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-[28px] border border-border/40 bg-card shadow-sm p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <SkeletonCircle className="w-14 h-14 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <SkeletonText className="w-32 h-5 mb-2" />
                <SkeletonText className="w-full h-3 mb-2" />
                <SkeletonText className="w-3/4 h-3 mb-2" />
                <div className="flex items-center gap-2 flex-wrap">
                  <SkeletonBox className="w-16 h-5 rounded-full" />
                  <SkeletonBox className="w-16 h-5 rounded-full" />
                  <SkeletonBox className="w-20 h-5 rounded-full" />
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <SkeletonText className="w-16 h-6 mb-1" />
                <SkeletonText className="w-12 h-3 mb-2" />
                <SkeletonBox className="w-16 h-9 rounded-full" />
              </div>
            </div>
          </div>
        ))}
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
