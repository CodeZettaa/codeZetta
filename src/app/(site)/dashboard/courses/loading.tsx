import { Skeleton } from "@/components/ui/skeleton";

export default function MyCoursesLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-10 w-48" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-28" />
      </div>
      <Skeleton className="mt-10 h-36 w-full rounded-2xl" />
    </main>
  );
}
