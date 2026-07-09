import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isAuthConfigured, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "DASHBOARD_PASSWORD no esta configurada" },
        { status: 503 },
      );
    }

    if (pathname !== "/login") {
      return NextResponse.redirect(new URL("/login?error=config", request.url));
    }

    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticated = sessionToken
    ? await verifySessionToken(sessionToken)
    : false;

  if (PUBLIC_PATHS.has(pathname)) {
    if (isAuthenticated && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};