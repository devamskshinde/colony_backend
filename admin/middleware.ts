import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public routes that don't need auth
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // For dashboard routes, let the client-side auth check in
  // DashboardLayout handle redirects. Server middleware cannot
  // read localStorage tokens, so we let all dashboard routes
  // through and redirect client-side if needed.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
