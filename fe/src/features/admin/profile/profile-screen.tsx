"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea, TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { type Locale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { refreshPublicSite } from "../actions";
import { PageHeader } from "../admin-shell";
import { ApiError, api, type Schemas, unwrap } from "../api";
import {
  FormCard,
  ImageField,
  LocalePanel,
  LocaleTabs,
  reportError,
  useFieldErrors,
} from "../form-parts";
import { useSession } from "../session";
import type { AdminStrings } from "../strings";
import {
  hasText,
  missingFields,
  type ProfileForm,
  type ProfileText,
  sameProfile,
  SPOKEN_LANGUAGES,
  type SpokenLanguage,
  toForm,
  toPayload,
} from "./profile-form";

type Profile = Schemas["Profile"];

export function ProfileScreen() {
  const { t } = useSession();
  const [saved, setSaved] = useState<{ profile?: Profile; form: ProfileForm }>();
  const [failed, setFailed] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    unwrap(api.GET("/api/v1/admin/profile")).then(
      (profile) => live && setSaved({ profile, form: toForm(profile) }),
      (e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setSaved({ form: toForm() });
        else setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (failed) {
    return (
      <>
        <PageHeader title={t.profile} lead={t.profileLead} />
        <ErrorState
          title={t.genericError}
          description={t.networkError}
          retryLabel={t.retry}
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </>
    );
  }
  if (!saved) {
    return (
      <>
        <PageHeader title={t.profile} lead={t.profileLead} />
        <div className="grid gap-4" aria-busy aria-label={t.loading}>
          <Skeleton className="h-72 rounded-[1.5rem]" />
          <Skeleton className="h-96 rounded-[1.5rem]" />
        </div>
      </>
    );
  }
  return (
    <Editor
      // A fresh editor after each save, so its baseline is what the server stored.
      key={saved.profile?.updatedAt ?? "new"}
      profile={saved.profile}
      initial={saved.form}
      onSaved={(profile) => setSaved({ profile, form: toForm(profile) })}
    />
  );
}

function Editor({
  profile,
  initial,
  onSaved,
}: {
  profile?: Profile;
  initial: ProfileForm;
  onSaved: (profile: Profile) => void;
}) {
  const { locale: uiLocale, t } = useSession();
  const [form, setForm] = useState(initial);
  const [locale, setLocale] = useState<Locale>(uiLocale);
  const [pending, setPending] = useState(false);
  const errors = useFieldErrors(t);
  const dirty = useMemo(() => !sameProfile(form, initial), [form, initial]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setText = (key: keyof ProfileText, value: string) =>
    setForm((f) => ({
      ...f,
      texts: { ...f.texts, [locale]: { ...f.texts[locale], [key]: value } },
    }));

  function showErrors(fields: Record<string, string>) {
    const first = locales.find((l) =>
      Object.keys(fields).some((f) => f.startsWith(`translations.${l}`)),
    );
    if (first) setLocale(first);
    toast(t.hasErrors, { tone: "error" });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(),
    );
  }

  async function save() {
    errors.clear();
    const missing = missingFields(form, locale);
    if (missing.length > 0) {
      const local = Object.fromEntries(missing.map((f) => [f, t.errRequired]));
      errors.set(local);
      showErrors(local);
      return;
    }
    setPending(true);
    try {
      const next = await unwrap(api.PUT("/api/v1/admin/profile", { body: toPayload(form) }));
      await refreshPublicSite().catch(() => false);
      toast(t.saved, { tone: "success", description: next.complete ? t.savedLive : undefined });
      onSaved(next);
    } catch (e) {
      const found = errors.capture(e);
      if (Object.keys(found).length > 0) showErrors(found);
      else reportError(t, e);
    } finally {
      setPending(false);
    }
  }

  const text = form.texts[locale];
  const prefix = `translations.${locale}.`;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageHeader
        title={t.profile}
        lead={t.profileLead}
        trailing={
          profile && (
            <Badge tone={profile.complete ? "green" : "orange"} className="mt-2">
              {profile.complete ? t.published : t.notPublished}
            </Badge>
          )
        }
      />

      <div className="grid gap-6">
        <FormCard title={t.photos}>
          <div className="grid grid-cols-2 gap-4">
            <ImageField
              t={t}
              label={t.portrait}
              hint={t.portraitHint}
              value={form.portrait}
              onChange={(m) => set("portrait", m)}
              error={errors.error("portraitMediaId")}
            />
            <ImageField
              t={t}
              label={t.cardPhoto}
              hint={t.cardPhotoHint}
              value={form.vcardPhoto}
              onChange={(m) => set("vcardPhoto", m)}
              error={errors.error("vcardPhotoMediaId")}
              aspect="aspect-square"
            />
          </div>
        </FormCard>

        <FormCard title={t.name}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.firstName}
              autoComplete="given-name"
              maxLength={60}
              required
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              error={errors.error("firstName")}
            />
            <TextField
              label={optionalLabel(t, t.lastName)}
              autoComplete="family-name"
              maxLength={60}
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              error={errors.error("lastName")}
            />
          </div>
          <TextField
            label={optionalLabel(t, t.organization)}
            autoComplete="organization"
            maxLength={120}
            value={form.organization}
            onChange={(e) => set("organization", e.target.value)}
            error={errors.error("organization")}
          />
        </FormCard>

        <FormCard title={t.contact}>
          <TextField
            label={t.phone}
            hint={t.phoneHint}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            maxLength={32}
            required
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={errors.error("phone")}
          />
          <TextField
            label={optionalLabel(t, t.whatsapp)}
            hint={t.whatsappHint}
            type="tel"
            inputMode="tel"
            dir="ltr"
            maxLength={32}
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            error={errors.error("whatsapp")}
          />
          <TextField
            label={t.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            spellCheck={false}
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.error("email")}
          />
          <TextField
            label={optionalLabel(t, t.linkedin)}
            type="url"
            inputMode="url"
            dir="ltr"
            placeholder="https://www.linkedin.com/in/…"
            spellCheck={false}
            value={form.linkedinUrl}
            onChange={(e) => set("linkedinUrl", e.target.value)}
            error={errors.error("linkedinUrl")}
          />
          <LanguagesField
            value={form.languages}
            onChange={(v) => set("languages", v)}
            error={errors.error("languages")}
          />
        </FormCard>

        <FormCard title={t.address}>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <TextField
              label={optionalLabel(t, t.mapUrl)}
              hint={t.mapUrlHint}
              type="url"
              inputMode="url"
              dir="ltr"
              placeholder="https://maps.app.goo.gl/…"
              spellCheck={false}
              value={form.mapUrl}
              onChange={(e) => set("mapUrl", e.target.value)}
              error={errors.error("mapUrl")}
            />
            <TextField
              label={optionalLabel(t, t.postalCode)}
              autoComplete="postal-code"
              dir="ltr"
              maxLength={20}
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
              error={errors.error("postalCode")}
            />
          </div>
        </FormCard>

        <FormCard title={t.translationsTitle} description={t.translationsLead}>
          <LocaleTabs
            label={t.language}
            value={locale}
            onChange={setLocale}
            filled={(l) => hasText(form.texts[l])}
            invalid={(l) => errors.hasPrefix(`translations.${l}`)}
          />
          <LocalePanel locale={locale}>
            <TextField
              label={optionalLabel(t, t.displayName)}
              hint={t.displayNameHint}
              maxLength={120}
              value={text.displayName}
              onChange={(e) => setText("displayName", e.target.value)}
              error={errors.error(`${prefix}displayName`)}
            />
            <TextField
              label={t.jobTitle}
              maxLength={120}
              value={text.title}
              onChange={(e) => setText("title", e.target.value)}
              error={errors.error(`${prefix}title`)}
            />
            <TextField
              label={optionalLabel(t, t.tagline)}
              maxLength={160}
              value={text.tagline}
              onChange={(e) => setText("tagline", e.target.value)}
              error={errors.error(`${prefix}tagline`)}
            />
            <Textarea
              label={optionalLabel(t, t.bio)}
              hint={t.paragraphHint}
              maxLength={1000}
              rows={6}
              value={text.bio}
              onChange={(e) => setText("bio", e.target.value)}
              error={errors.error(`${prefix}bio`)}
            />
            <Textarea
              label={optionalLabel(t, t.whatsappMessage)}
              hint={t.whatsappMessageHint}
              maxLength={500}
              rows={2}
              value={text.whatsappMessage}
              onChange={(e) => setText("whatsappMessage", e.target.value)}
              error={errors.error(`${prefix}whatsappMessage`)}
            />
            <p className="mt-2 px-1 text-footnote font-semibold tracking-[0.18em] text-gold uppercase">
              {t.address}
            </p>
            <TextField
              label={optionalLabel(t, t.street)}
              autoComplete="street-address"
              maxLength={200}
              value={text.street}
              onChange={(e) => setText("street", e.target.value)}
              error={errors.error(`${prefix}address.street`)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={optionalLabel(t, t.city)}
                maxLength={80}
                value={text.city}
                onChange={(e) => setText("city", e.target.value)}
                error={errors.error(`${prefix}address.city`)}
              />
              <TextField
                label={optionalLabel(t, t.country)}
                maxLength={80}
                value={text.country}
                onChange={(e) => setText("country", e.target.value)}
                error={errors.error(`${prefix}address.country`)}
              />
            </div>
            {!hasText(text) && (
              <p className="px-1 text-footnote text-label-secondary">{t.notTranslated}</p>
            )}
          </LocalePanel>
        </FormCard>
      </div>

      {/* Rides above the phone tab bar while the form scrolls, and settles under it at the end. */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] z-20 mt-8 md:bottom-6">
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl material-chrome p-2 shadow-float ring-1 ring-label/[0.06] transition-opacity sm:ps-4",
            !dirty && !pending && "pointer-events-none opacity-0",
          )}
          inert={!dirty && !pending}
        >
          <p className="hidden min-w-0 flex-1 truncate text-subheadline text-label-secondary sm:block">
            {t.unsavedChanges}
          </p>
          <Button
            type="button"
            variant="plain"
            size="sm"
            disabled={pending}
            onClick={() => {
              errors.clear();
              setForm(initial);
            }}
          >
            {t.cancel}
          </Button>
          <Button type="submit" size="sm" loading={pending} className="flex-1 sm:flex-none">
            {t.saveChanges}
          </Button>
        </div>
      </div>
    </form>
  );
}

function optionalLabel(t: AdminStrings, label: string) {
  return (
    <>
      {label} <span className="font-normal text-label-tertiary">· {t.optional}</span>
    </>
  );
}

/** Chips for the languages spoken, in display order, with a picker for the rest. */
function LanguagesField({
  value,
  onChange,
  error,
}: {
  value: SpokenLanguage[];
  onChange: (value: SpokenLanguage[]) => void;
  error?: string;
}) {
  const { t } = useSession();
  const names = useMemo(() => {
    const display = new Intl.DisplayNames([t.formatLocale], { type: "language" });
    return (code: string) => display.of(code) ?? code;
  }, [t.formatLocale]);
  const rest = SPOKEN_LANGUAGES.filter((l) => !value.includes(l)).sort((a, b) =>
    names(a).localeCompare(names(b), t.formatLocale),
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 px-1 text-footnote font-medium text-label-secondary">
        {t.languagesSpoken}
      </legend>
      <div className="flex flex-wrap gap-2">
        {value.map((code) => (
          <span
            key={code}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-gold/12 ps-3.5 pe-1 text-subheadline font-medium text-label"
          >
            {names(code)}
            <button
              type="button"
              aria-label={`${t.delete}: ${names(code)}`}
              onClick={() => onChange(value.filter((c) => c !== code))}
              className="grid size-7 pressable place-items-center rounded-full text-label-secondary hover:bg-fill-tertiary"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        ))}
        {rest.length > 0 && (
          <label className="relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-separator px-3.5 text-subheadline font-medium text-tint focus-within:ring-2 focus-within:ring-tint">
            <Plus aria-hidden className="size-4" />
            {t.addLanguage}
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              value=""
              onChange={(e) => {
                const code = e.target.value as SpokenLanguage;
                if (code) onChange([...value, code]);
              }}
            >
              <option value="" disabled>
                {t.addLanguage}
              </option>
              {rest.map((code) => (
                <option key={code} value={code}>
                  {names(code)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className={cn("px-1 text-footnote", error ? "text-system-red" : "text-label-secondary")}>
        {error ?? t.languagesHint}
      </p>
    </fieldset>
  );
}
