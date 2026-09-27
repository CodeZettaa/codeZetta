import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { logoutAction } from "@/features/auth/actions";
import { getCurrentUser } from "@/server/authz";
import { cn } from "cn";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            CZ
          </span>
          <span className="text-sm font-medium tracking-tight">CodeZetta</span>
        </Link>
        <DesktopNav />
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-3")}
              >
                {user.name?.split(" ")[0] || "Dashboard"}
              </Link>
              {user.role === "ADMIN" ? (
                <Link
                  href="/admin"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-3")}
                >
                  Admin
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-3")}
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-3")}
              >
                Log in
              </Link>
              <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "h-8 px-3")}>
                Register
              </Link>
            </>
          )}
        </div>
        <div className="ml-auto md:hidden">
          <MobileNav
            user={user ? { name: user.name, email: user.email, role: user.role } : null}
          />
        </div>
      </div>
    </header>
  );
}
