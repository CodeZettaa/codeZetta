import { Skeleton } from "@/components/ui/skeleton";

export default function AdminFeedbackLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:px-8">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="mt-8 h-10 w-40" />
      <Skeleton className="mt-8 h-36 w-full rounded-2xl" />
      <Skeleton className="mt-4 h-36 w-full rounded-2xl" />
    </main>
  );
}
