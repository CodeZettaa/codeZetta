import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-72 max-w-full" />
      <Skeleton className="mt-10 h-4 w-36" />
      <div className="mt-4 grid overflow-hidden rounded-2xl border border-border md:grid-cols-[13rem_minmax(0,1fr)]">
        <Skeleton className="aspect-[2/1] w-full rounded-none md:aspect-auto md:h-56" />
        <div className="p-5 md:p-7">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <Skeleton className="mt-6 h-4 w-40" />
          <Skeleton className="mt-2 h-6 w-56" />
          <Skeleton className="mt-6 h-2 w-full max-w-md" />
          <Skeleton className="mt-6 h-11 w-40" />
        </div>
      </div>
      <Skeleton className="mt-12 h-6 w-32" />
      <Skeleton className="mt-4 h-36 w-full rounded-2xl" />
    </main>
  );
}
