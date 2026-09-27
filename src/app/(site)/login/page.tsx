import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeCallbackPath } from "@/server/request";
import { getCurrentUser } from "@/server/authz";

export const metadata: Metadata = {
  title: "Log in",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl ?? null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-16 md:py-24">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Account</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Log in</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Continue a course, or pick up the lesson you left.
      </p>
      <div className="mt-8">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={callbackUrl === "/dashboard" ? "/register" : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
