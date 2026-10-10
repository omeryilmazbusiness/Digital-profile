"use client";

import { Plus, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { MediaImage } from "@/components/ui/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea, TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { directionOf, type Locale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { refreshPublicSite } from "../actions";
import { PageHeader } from "../admin-shell";
import { ApiError, api, type Schemas, unwrap } from "../api";
import {
  FormCard,
  FormRow,
  ImageField,
  LocalePanel,
  LocaleTabs,
  reportError,
  tabNames,
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

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    errors.dismiss(imageFields[key as string] ?? key);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setTextIn = (l: Locale, key: keyof ProfileText, value: string) => {
    errors.dismiss(`translations.${l}.${addressFields.has(key) ? `address.${key}` : key}`);
    setForm((f) => ({
      ...f,
      texts: { ...f.texts, [l]: { ...f.texts[l], [key]: value } },
    }));
  };
  const setText = (key: keyof ProfileText, value: string) => setTextIn(locale, key, value);

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
  const saveButton = (
    <Button type="submit" size="sm" shape="capsule" loading={pending} className="px-4">
      {t.save}
    </Button>
  );

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
        actions={(dirty || pending) && saveButton}
      />

      <div className="grid gap-8">
        <ContactCard form={form} profile={profile} />

        <FormCard title={t.name} description={t.nameLead}>
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
          <TextField
            label={optionalLabel(t, t.organization)}
            autoComplete="organization"
            maxLength={120}
            value={form.organization}
            onChange={(e) => set("organization", e.target.value)}
            error={errors.error("organization")}
          />
        </FormCard>

        <FormCard title={t.jobTitle} description={t.jobTitleLead}>
          {locales.map((l) => (
            <TextField
              key={l}
              label={
                <>
                  {t.jobTitle}{" "}
                  <span className="font-normal text-label-tertiary">· {tabNames[l]}</span>
                </>
              }
              lang={l}
              dir={directionOf(l)}
              autoComplete="organization-title"
              maxLength={120}
              value={form.texts[l].title}
              onChange={(e) => setTextIn(l, "title", e.target.value)}
              error={errors.error(`translations.${l}.title`)}
            />
          ))}
        </FormCard>

        <FormCard title={t.photos}>
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
          <ImageField
            t={t}
            label={t.businessCard}
            hint={t.businessCardHint}
            value={form.businessCard}
            onChange={(m) => set("businessCard", m)}
            error={errors.error("businessCardMediaId")}
            aspect="aspect-[7/4]"
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
          <FormRow>
            <LanguagesField
              value={form.languages}
              onChange={(v) => set("languages", v)}
              error={errors.error("languages")}
            />
          </FormRow>
        </FormCard>

        <FormCard title={t.address}>
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
        </FormCard>

        <FormCard title={t.translationsTitle} description={t.translationsLead}>
          <FormRow>
            <LocaleTabs
              label={t.language}
              value={locale}
              onChange={setLocale}
              filled={(l) => hasText(form.texts[l])}
              invalid={(l) => errors.hasPrefix(`translations.${l}`)}
            />
            {!hasText(text) && (
              <p className="mt-2.5 px-1 text-footnote text-label-secondary">{t.notTranslated}</p>
            )}
          </FormRow>
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
            <TextField
              label={optionalLabel(t, t.street)}
              autoComplete="street-address"
              maxLength={200}
              value={text.street}
              onChange={(e) => setText("street", e.target.value)}
              error={errors.error(`${prefix}address.street`)}
            />
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
          </LocalePanel>
        </FormCard>
      </div>

      {/* Rides above the phone tab bar while the form scrolls, and settles under it at the end. */}
      <div className="sticky bottom-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+5.25rem)] z-20 mt-8 md:bottom-6">
        <div
          className={cn(
            "mx-auto flex max-w-md items-center gap-2 rounded-full material-chrome p-1.5 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.35),0_0_0_0.5px_rgb(0_0_0/0.06)] transition-[opacity,translate] duration-(--duration-base) ease-ios sm:ps-5",
            !dirty && !pending && "pointer-events-none translate-y-3 opacity-0",
          )}
          inert={!dirty && !pending}
        >
          <p className="hidden min-w-0 flex-1 truncate text-subheadline font-medium text-label-secondary sm:block">
            {t.unsavedChanges}
          </p>
          <Button
            type="button"
            variant="plain"
            size="sm"
            shape="capsule"
            className="flex-1 sm:flex-none"
            disabled={pending}
            onClick={() => {
              errors.clear();
              setForm(initial);
            }}
          >
            {t.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            shape="capsule"
            loading={pending}
            className="flex-[2] px-5 sm:flex-none"
          >
            {t.saveChanges}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * The profile as visitors meet it, like the top of a contact in iOS Contacts: the portrait,
 * the name and the job title, updating as they are typed.
 */
function ContactCard({ form, profile }: { form: ProfileForm; profile?: Profile }) {
  const { locale, t } = useSession();
  const text = form.texts[locale];
  const title =
    text.title.trim() || locales.map((l) => form.texts[l].title.trim()).find(Boolean) || "";
  const name =
    text.displayName.trim() || [form.firstName, form.lastName].join(" ").trim() || t.untitled;
  const initials = [form.firstName, form.lastName]
    .map((part) => part.trim().charAt(0))
    .join("")
    .toUpperCase();

  return (
    <section
      aria-label={t.profile}
      className="relative -mt-2 flex flex-col items-center overflow-hidden rounded-[1.75rem] bg-bg-grouped-secondary px-6 pt-8 pb-6 text-center shadow-[0_1px_2px_rgb(0_0_0/0.03)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-gold/12 to-transparent"
      />
      <div className="relative size-28 overflow-hidden rounded-full bg-linear-to-b from-neutral-300 to-neutral-400 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.45)] ring-4 ring-bg-grouped-secondary">
        {form.portrait ? (
          <MediaImage source={form.portrait} alt="" sizes="7rem" fill imgClassName="object-top" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[2.5rem] font-semibold text-white">
            {initials || <UserRound aria-hidden className="size-12" strokeWidth={1.5} />}
          </span>
        )}
      </div>
      <p className="relative mt-4 text-title-2 font-bold tracking-[-0.01em] text-balance">{name}</p>
      {title && (
        <p className="relative mt-0.5 text-subheadline font-medium text-label-secondary">{title}</p>
      )}
      {form.organization.trim() && (
        <p className="relative text-footnote text-label-tertiary">{form.organization}</p>
      )}
      {profile && (
        <Badge tone={profile.complete ? "green" : "orange"} className="relative mt-4">
          {profile.complete ? t.published : t.notPublished}
        </Badge>
      )}
    </section>
  );
}

/** The API's field names for the form's images. */
const imageFields: Record<string, string> = {
  portrait: "portraitMediaId",
  vcardPhoto: "vcardPhotoMediaId",
  businessCard: "businessCardMediaId",
};
const addressFields = new Set<keyof ProfileText>(["street", "city", "country"]);

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
