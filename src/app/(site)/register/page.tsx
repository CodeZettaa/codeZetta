import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getCurrentUser } from "@/server/authz";
import { safeCallbackPath } from "@/server/request";

export const metadata: Metadata = {
  title: "Register",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await getCurrentUser();
  const callbackUrl = safeCallbackPath((await searchParams).callbackUrl ?? null);
  if (user) redirect(callbackUrl);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-16 md:py-24">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Account</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Create your account</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Buy a course after you create your account, or wait for the instructor to enroll you.
      </p>
      <div className="mt-8">
        <RegisterForm callbackUrl={callbackUrl} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href={callbackUrl === "/dashboard" ? "/login" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
