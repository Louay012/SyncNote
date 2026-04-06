import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./lib/authToken";

function isAuthenticated(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(token && token.trim());
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);
  const publicAuthRoutes = ["/auth", "/login", "/signup"];
  const protectedRoutes = [
    "/",
    "/documents",
    "/discover",
    "/invitations",
    "/profile",
    "/settings"
  ];
  const protectedPrefixRoutes = ["/doc/"];

  if (pathname === "/login" || pathname === "/signup") {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (publicAuthRoutes.includes(pathname) && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requiresAuth =
    protectedRoutes.includes(pathname) ||
    protectedPrefixRoutes.some((prefix) => pathname.startsWith(prefix));

  if (requiresAuth && !authenticated) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/documents",
    "/discover",
    "/invitations",
    "/auth",
    "/login",
    "/signup",
    "/doc/:path*",
    "/profile",
    "/settings"
  ]
};
