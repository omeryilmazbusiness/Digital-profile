import { type NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/i18n/locales";
import { negotiateLocale } from "@/i18n/negotiate";
import { localeOfPath, localizeHref, SITE_BASE } from "@/i18n/routing";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** The API's access cookie: `__Host-` prefixed over https, plain on http://localhost. */
const ACCESS_COOKIES = ["__Host-dp_access", "dp_access"];
const ADMIN_PAGE = /^\/sheraton\/[^/]+\/admin(?:\/|$)/;

/**
 * Sends addresses without a language — "/", "/sheraton", and the card's short link "/momen"
 * (printed in QR codes) — to their page in the visitor's language, and remembers the language
 * of every page read.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;

  const locale = localeOfPath(pathname);

  // Without a session cookie the panel can only show a spinner, so go straight to sign-in; the
  // sign-in page renews an expired session itself and comes back. The API still checks every call.
  if (
    locale &&
    ADMIN_PAGE.test(pathname) &&
    !pathname.startsWith(`${SITE_BASE}/${locale}/admin/login`) &&
    !ACCESS_COOKIES.some((name) => request.cookies.has(name))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `${SITE_BASE}/${locale}/admin/login`;
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (locale || pathname.startsWith(`${SITE_BASE}/`)) {
    const response = NextResponse.next();
    if (locale && remembered !== locale) {
      response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  const target = negotiateLocale({
    cookie: remembered,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const url = request.nextUrl.clone();
  url.pathname = localizeHref(target, pathname === SITE_BASE ? "/" : (pathname as `/${string}`));
  const response = NextResponse.redirect(url);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: ["/", "/sheraton", "/sheraton/:locale/:path*", "/momen/:path*"],
};
