"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { LanguageMenu } from "@/features/site/language-switch";
import type { Locale } from "@/i18n/locales";

import { api, ApiError, errorKind, unwrap } from "./api";
import { safeNext } from "./paths";
import { currentAdmin } from "./session";
import type { AdminStrings } from "./strings";

export function LoginScreen({ locale, t }: { locale: Locale; t: AdminStrings }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"), locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  // Already signed in (or a refresh cookie is still valid): skip the form.
  useEffect(() => {
    let live = true;
    currentAdmin().then(
      (admin) => {
        if (live && admin) router.replace(next);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [router, next]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await unwrap(api.POST("/api/v1/auth/login", { body: { email: email.trim(), password } }));
      router.replace(next);
    } catch (e) {
      const kind = errorKind(e);
      setError(
        kind === "network"
          ? t.networkError
          : kind === "rateLimited"
            ? t.tooManyAttempts
            : e instanceof ApiError && (e.status === 401 || e.status === 400)
              ? t.invalidCredentials
              : t.genericError,
      );
      setPending(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg-grouped px-safe-5 py-12">
      {/* A soft gold light behind the card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-gold/20 blur-[120px]"
      />
      <div className="absolute end-4 top-4 pt-safe">
        <LanguageMenu label={t.language} />
      </div>

      <main className="relative w-full max-w-sm">
        <div className="mb-8 grid justify-items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-label text-bg shadow-lift">
            <LockKeyhole aria-hidden className="size-6" />
          </span>
          <p className="text-[0.6875rem] font-semibold tracking-[0.28em] text-gold uppercase">
            {t.brand} · {t.admin}
          </p>
          <h1 className="font-display text-[2rem] leading-tight font-semibold">{t.signInTitle}</h1>
          <p className="text-body text-label-secondary">{t.signInLead}</p>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-4 rounded-[1.75rem] bg-bg-grouped-secondary p-5 shadow-card ring-1 ring-label/[0.04] sm:p-6"
          noValidate
        >
          <TextField
            label={t.email}
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <TextField
              label={t.password}
              type={reveal ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? t.hidePassword : t.showPassword}
              aria-pressed={reveal}
              className="absolute end-1 bottom-1 grid size-10 pressable place-items-center rounded-md text-label-secondary hover:text-label"
            >
              {reveal ? (
                <EyeOff aria-hidden className="size-5" />
              ) : (
                <Eye aria-hidden className="size-5" />
              )}
            </button>
          </div>

          <p
            role="alert"
            aria-live="assertive"
            className="min-h-5 px-1 text-footnote text-system-red"
          >
            {error}
          </p>

          <Button
            type="submit"
            size="lg"
            block
            loading={pending}
            disabled={!email.trim() || !password}
          >
            {t.signIn}
          </Button>
        </form>
      </main>
    </div>
  );
}
