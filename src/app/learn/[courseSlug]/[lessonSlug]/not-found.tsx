import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function LessonNotFound() {
  return (
    <main className="mx-auto flex min-h-[50svh] w-full max-w-lg flex-col justify-center px-5 py-16">
      <h1 className="text-3xl font-medium tracking-tight">This lesson is not available.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        It may have been moved, or it belongs to a different course.
      </p>
      <Link href="/courses" className={cn(buttonVariants(), "mt-6 h-11 w-fit px-4")}>
        Browse courses
      </Link>
    </main>
  );
}
