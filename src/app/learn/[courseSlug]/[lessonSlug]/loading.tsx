import { Skeleton } from "@/components/ui/skeleton";

export default function LearnLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="mt-6 h-4 w-48" />
      <Skeleton className="mt-3 h-8 w-2/3" />
      <Skeleton className="mt-4 h-16 w-full max-w-2xl" />
    </div>
  );
}
