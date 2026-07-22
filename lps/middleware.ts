import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gate the whole app behind the harness login — the same credentials as the
// harness user store (harness/.secrets/users.json) and the availability
// service login (HARNESS_USER / HARNESS_PASS). A visitor without a session is
// bounced to /login.
//
// The harness is the real authority: it validates the `pi_sid` session on every
// proxied /api and /admin call (see next.config.ts rewrites). This middleware
// just keeps the UI shell from rendering for anyone who hasn't signed in.
//
// Public exceptions (no session required):
//   /login           — the sign-in page itself
//   /api/auth/*      — the login endpoint the form posts to
//   /stock-check/*   — the shared grower stock-check form (page)
//   /api/stock-check/* — its backend (talks to the harness with a service
//                     login, not the visitor's session)
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/stock-check", "/api/stock-check"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (req.cookies.has("pi_sid")) return NextResponse.next();

  // Don't redirect API/proxy calls into HTML — a fetch() following the redirect
  // would get the login page. Answer with 401 (the harness 401s these too).
  if (pathname.startsWith("/api") || pathname.startsWith("/admin")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
