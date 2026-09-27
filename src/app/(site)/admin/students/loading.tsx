import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-8 h-10 w-48" />
      <Skeleton className="mt-6 h-11 w-full max-w-xl" />
      <div className="mt-8 grid gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </main>
  );
}
