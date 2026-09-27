import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-16">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-10 w-56" />
      <Skeleton className="mt-8 h-11 w-full max-w-xl" />
      <Skeleton className="mt-4 h-11 w-full max-w-xl" />
      <Skeleton className="mt-4 h-32 w-full max-w-xl" />
    </main>
  );
}
