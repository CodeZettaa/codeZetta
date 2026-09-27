import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth);
  const role = request.auth?.user?.role;

  if (
    (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/checkout")) &&
    !isLoggedIn
  ) {
    const url = new URL("/login", request.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    const callback = request.nextUrl.searchParams.get("callbackUrl");
    const safe =
      callback &&
      callback.startsWith("/") &&
      !callback.startsWith("//") &&
      !callback.startsWith("/login") &&
      !callback.startsWith("/register") &&
      !callback.includes("\\")
        ? callback
        : "/dashboard";
    if (safe.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    }
    return NextResponse.redirect(new URL(safe, request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/checkout",
    "/checkout/:path*",
    "/login",
    "/register",
  ],
};
