import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie present, not validated): sends signed-out visitors to the landing page
// before any app shell renders. The real check is verifySession() in the DAL on every read and write.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/projects/:path*", "/jobs/:path*", "/resumes/:path*", "/onboarding/:path*"],
};
