import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./lib/authToken";

function isAuthenticated(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(token && token.trim());
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);
  const publicAuthRoutes = ["/login", "/signup"];

  if (publicAuthRoutes.includes(pathname) && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup"]
};
