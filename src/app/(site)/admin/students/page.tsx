import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { getAdminStudents } from "@/features/admin/queries";
import { formatDate } from "@/lib/time";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Students" };

const filters = [
  { id: "all", label: "All" },
  { id: "enrolled", label: "Enrolled" },
  { id: "none", label: "Not enrolled" },
] as const;

type FilterId = (typeof filters)[number]["id"];

function hrefFor(filter: FilterId, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("enrollment", filter);
  const value = params.toString();
  return value ? `/admin/students?${value}` : "/admin/students";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; enrollment?: string }>;
}) {
  const { q = "", enrollment = "all" } = await searchParams;
  const filter: FilterId = filters.some((item) => item.id === enrollment) ? (enrollment as FilterId) : "all";
  const students = await getAdminStudents(q, filter);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <AdminNav current="/admin/students" />
      <h1 className="mt-8 text-3xl font-medium tracking-tight">Students</h1>
      <p className="mt-2 text-sm text-muted-foreground">Search by name or email. Passwords are never shown.</p>
      <form method="get" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="student-search" className="sr-only">
          Search students
        </label>
        <input
          id="student-search"
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {filter !== "all" ? <input type="hidden" name="enrollment" value={filter} /> : null}
        <button type="submit" className="h-11 rounded-lg border border-border px-4 text-sm">
          Search
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2" role="navigation" aria-label="Filter students">
        {filters.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item.id, q)}
            aria-current={filter === item.id ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground",
              filter === item.id && "border-foreground/20 bg-muted text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {students.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={q || filter !== "all" ? "No students match that search." : "No students yet."}
            body={
              q || filter !== "all"
                ? "Try another name, email, or filter."
                : "Students appear here after they register."
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-8 grid gap-3 md:hidden">
            {students.map((student) => (
              <li key={student.id} className="rounded-2xl border border-border p-4">
                <Link href={`/admin/students/${student.id}`} className="font-medium hover:text-primary">
                  {student.name || "Unnamed student"}
                </Link>
                <p className="mt-1 break-all text-sm text-muted-foreground">{student.email}</p>
                <p className="mt-3 text-sm text-muted-foreground">Joined {formatDate(student.createdAt)}</p>
                <p className="mt-1 text-sm">
                  {student.enrollments.length === 0
                    ? "No active courses"
                    : `${student.enrollments.length} active ${student.enrollments.length === 1 ? "course" : "courses"}`}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8 hidden overflow-hidden rounded-2xl border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Active courses</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/students/${student.id}`} className="font-medium hover:text-primary">
                        {student.name || "Unnamed student"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 break-all">{student.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(student.createdAt)}</td>
                    <td className="px-4 py-3">{student.enrollments.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
