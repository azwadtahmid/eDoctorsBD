import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Route guards for the dashboard pages.
 *
 * The API routes each do their own session + role check (that is the real
 * authorisation boundary, and it stays). This layer stops an unauthenticated
 * or wrong-role user from ever reaching the page shell — previously
 * /dashboard/admin rendered for anybody and merely showed "Forbidden" once its
 * fetch came back, which leaks the existence and shape of the admin surface.
 */

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  DOCTOR: "/dashboard/doctor",
  PATIENT: "/dashboard/patient",
};

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth?.token as any)?.role as string | undefined;
    const path = req.nextUrl.pathname;

    const required =
      path.startsWith("/dashboard/admin")
        ? "ADMIN"
        : path.startsWith("/dashboard/doctor")
        ? "DOCTOR"
        : path.startsWith("/dashboard/patient")
        ? "PATIENT"
        : null;

    if (required && role !== required) {
      // Send people to their own dashboard rather than telling them whether
      // the area they probed exists.
      const home = (role && ROLE_HOME[role]) || "/";
      return NextResponse.redirect(new URL(home, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Any signed-in user passes this gate; the role check above narrows it.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
