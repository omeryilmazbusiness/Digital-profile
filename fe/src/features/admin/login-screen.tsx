"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { LanguageMenu } from "@/features/site/language-switch";
import type { Locale } from "@/i18n/locales";

import { api, ApiError, errorKind, unwrap } from "./api";
import { FormCard } from "./form-parts";
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
          <span className="grid size-16 place-items-center rounded-[1.125rem] bg-linear-to-b from-neutral-800 to-black text-white shadow-[0_14px_30px_-12px_rgb(0_0_0/0.5)]">
            <LockKeyhole aria-hidden className="size-7" strokeWidth={1.8} />
          </span>
          <p className="text-[0.6875rem] font-semibold tracking-[0.28em] text-gold uppercase">
            {t.brand} · {t.admin}
          </p>
          <h1 className="text-large-title font-bold tracking-[-0.02em]">{t.signInTitle}</h1>
          <p className="text-body text-label-secondary">{t.signInLead}</p>
        </div>

        <form onSubmit={submit} className="grid gap-3" noValidate>
          <FormCard>
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
                className="pe-14"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? t.hidePassword : t.showPassword}
                aria-pressed={reveal}
                className="absolute end-2 top-1/2 grid size-10 -translate-y-1/2 pressable place-items-center rounded-full text-label-secondary hover:text-label"
              >
                {reveal ? (
                  <EyeOff aria-hidden className="size-5" />
                ) : (
                  <Eye aria-hidden className="size-5" />
                )}
              </button>
            </div>
          </FormCard>

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
            shape="capsule"
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
