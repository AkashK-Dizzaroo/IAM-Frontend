import React from "react";
import { Skeleton } from "./Skeleton";

export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-60 space-y-3 md:block">
          {Array.from({ length: 7 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full rounded-lg" />
          ))}
        </aside>

        <main className="flex-1 space-y-4">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

