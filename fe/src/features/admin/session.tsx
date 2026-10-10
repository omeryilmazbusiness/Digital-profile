"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useState } from "react";
import type * as React from "react";

import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/locales";

import { api, errorKind, refreshSession, type Schemas, SIGNED_OUT_EVENT, unwrap } from "./api";
import { adminHref } from "./paths";
import type { AdminStrings } from "./strings";

type AdminUser = Schemas["AdminUser"];

interface Session {
  admin: AdminUser;
  locale: Locale;
  t: AdminStrings;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error("useSession outside <AdminSession>");
  return session;
}

/** The signed-in admin, renewing the session once, or undefined when signed out. */
export async function currentAdmin(): Promise<AdminUser | undefined> {
  const me = () => api.GET("/api/v1/auth/me");
  let result = await me();
  if (result.response.status === 401 && (await refreshSession())) result = await me();
  if (result.response.status === 401) return undefined;
  return unwrap(Promise.resolve(result));
}

/**
 * Shows its children only to a signed-in admin. Anyone else, or an admin whose session ends
 * while working, is sent to the sign-in page and brought back here afterwards.
 */
export function AdminSession({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: AdminStrings;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? adminHref(locale);
  const [admin, setAdmin] = useState<AdminUser>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const toLogin = useCallback(
    () => router.replace(`${adminHref(locale, "/login")}?next=${encodeURIComponent(pathname)}`),
    [router, locale, pathname],
  );

  useEffect(() => {
    let live = true;
    currentAdmin().then(
      (user) => {
        if (!live) return;
        if (user) setAdmin(user);
        else toLogin();
      },
      (error: unknown) => {
        if (!live) return;
        if (errorKind(error) === "session") toLogin();
        else setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [attempt, toLogin]);

  useEffect(() => {
    const onSignedOut = () => {
      toast(t.sessionExpired, { tone: "error" });
      toLogin();
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [t, toLogin]);

  const signOut = useCallback(async () => {
    await api.POST("/api/v1/auth/logout").catch(() => undefined);
    router.replace(adminHref(locale, "/login"));
  }, [router, locale]);

  if (failed) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg-grouped p-6">
        <ErrorState
          title={t.genericError}
          description={t.networkError}
          retryLabel={t.retry}
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  }
  if (!admin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg-grouped">
        <Spinner size="lg" label={t.loading} />
      </div>
    );
  }
  return <SessionContext value={{ admin, locale, t, signOut }}>{children}</SessionContext>;
}
