import Link from "next/link";
import { getCurrentUser } from "@/server/authz";

export async function SiteFooter() {
  const user = await getCurrentUser();

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="text-sm font-medium">CodeZetta</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Engineering education for developers who want depth over memorized syntax.
          </p>
        </div>
        <nav className="flex gap-5 text-sm text-muted-foreground">
          <Link href="/courses" className="hover:text-foreground">
            Courses
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href={user ? "/dashboard" : "/login"} className="hover:text-foreground">
            {user ? "Dashboard" : "Log in"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
