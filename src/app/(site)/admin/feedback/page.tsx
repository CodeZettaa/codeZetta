import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { setFeedbackStatus } from "@/features/feedback/actions";
import { getAdminFeedback } from "@/features/feedback/queries";
import { formatRelative } from "@/lib/time";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Feedback" };

const typeLabels = {
  CONTENT: "Content",
  TECHNICAL_ISSUE: "Technical issue",
  SUGGESTION: "Suggestion",
  OTHER: "Other",
} as const;

type FeedbackPageProps = {
  searchParams: Promise<{ status?: string; type?: string; course?: string }>;
};

export default async function AdminFeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const notes = await getAdminFeedback();
  const status = params.status === "NEW" || params.status === "READ" || params.status === "RESOLVED" ? params.status : "ALL";
  const type = params.type && params.type in typeLabels ? params.type : "ALL";
  const courses = [...new Map(notes.map((note) => [note.course.id, note.course.title])).entries()];
  const visible = notes.filter((note) => {
    if (status !== "ALL" && note.status !== status) return false;
    if (type !== "ALL" && note.type !== type) return false;
    if (params.course && note.course.id !== params.course) return false;
    return true;
  });

  function href(next: { status?: string; type?: string; course?: string }) {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? (status === "ALL" ? "" : status);
    const nextType = next.type ?? (type === "ALL" ? "" : type);
    const nextCourse = next.course ?? params.course ?? "";
    if (nextStatus) query.set("status", nextStatus);
    if (nextType) query.set("type", nextType);
    if (nextCourse) query.set("course", nextCourse);
    const value = query.toString();
    return value ? `/admin/feedback?${value}` : "/admin/feedback";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <AdminNav current="/admin/feedback" />
      <h1 className="mt-8 text-2xl font-medium tracking-tight">Feedback</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Private notes from enrolled students.</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {(["ALL", "NEW", "READ", "RESOLVED"] as const).map((item) => (
          <Link
            key={item}
            href={href({ status: item === "ALL" ? "" : item })}
            className={cn("px-2 py-1", status === item ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            aria-current={status === item ? "page" : undefined}
          >
            {item === "ALL" ? "All" : item === "NEW" ? "New" : item === "READ" ? "Read" : "Resolved"}
          </Link>
        ))}
      </div>

      <form className="mt-3 flex flex-wrap gap-3" action="/admin/feedback">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        <select name="type" defaultValue={type === "ALL" ? "" : type} className="h-9 bg-transparent text-sm">
          <option value="">All types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="course" defaultValue={params.course ?? ""} className="h-9 max-w-xs bg-transparent text-sm">
          <option value="">All courses</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
          Filter
        </button>
      </form>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No feedback yet." body="Notes appear here after a student sends one from a lesson." />
        </div>
      ) : (
        <ul className="mt-6">
          {visible.map((note) => (
            <li key={note.id} className="border-t border-border py-4">
              <p className="text-sm font-medium">{typeLabels[note.type]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {note.course.title}
                {note.lesson ? ` · ${note.lesson.title}` : ""}
              </p>
              <p className="mt-2 text-sm">
                {note.user.name || "Student"} · {formatRelative(note.createdAt)}
              </p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{note.message}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {note.lesson ? (
                  <Link
                    href={`/admin/courses/${note.course.id}/lessons/${note.lesson.id}`}
                    className="text-primary hover:underline"
                  >
                    View lesson
                  </Link>
                ) : null}
                {note.status !== "RESOLVED" ? (
                  <form action={setFeedbackStatus.bind(null, note.id, "RESOLVED")}>
                    <button type="submit" className="text-muted-foreground hover:text-foreground">
                      Mark resolved
                    </button>
                  </form>
                ) : (
                  <span className="text-muted-foreground">Resolved</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
