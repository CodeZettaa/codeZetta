import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { getAdminOverview } from "@/features/admin/queries";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

const cards = [
  { key: "courses", label: "Courses", href: "/admin/courses" },
  { key: "students", label: "Students", href: "/admin/students" },
  { key: "enrollments", label: "Enrollments", href: "/admin/enrollments" },
  { key: "lessons", label: "Lessons", href: "/admin/courses" },
] as const;

export default async function AdminPage() {
  const overview = await getAdminOverview();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">Admin</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Publish courses, arrange the curriculum, and grant access. Checkout is still manual.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-2xl border border-border p-5 transition-colors hover:border-foreground/20"
          >
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{card.label}</p>
            <p className="mt-3 text-3xl font-medium tracking-tight">{overview[card.key]}</p>
          </Link>
        ))}
      </div>
      <Link href="/admin/courses/new" className={cn(buttonVariants(), "mt-8 h-10 px-4")}>
        New course
      </Link>
    </main>
  );
}
