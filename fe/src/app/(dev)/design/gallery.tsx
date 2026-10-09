"use client";

import {
  BedDouble,
  Bell,
  Globe,
  ImageOff,
  Mail,
  MapPin,
  Phone,
  Plus,
  Share,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useState } from "react";
import type * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DirectionProvider } from "@/components/ui/direction";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconButton } from "@/components/ui/icon-button";
import { ListIcon, ListItem, ListSection } from "@/components/ui/list";
import { MediaImage } from "@/components/ui/media-image";
import { Reveal } from "@/components/ui/motion";
import { NavBar } from "@/components/ui/nav-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea, TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";

type Theme = "system" | "light" | "dark";
type Direction = "ltr" | "rtl";

/** A stand-in for an uploaded image, so the gallery needs no API. */
function demoImage(hue: number) {
  const svg = (w: number) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${(w * 2) / 3}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 42%)"/><stop offset="1" stop-color="hsl(${hue + 40} 70% 18%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
    )}`;
  return {
    width: 1600,
    height: 1067,
    variants: [480, 960, 1600].map((w) => ({ width: w, url: svg(w) })),
  };
}

const swatches = [
  ["tint", "bg-tint"],
  ["gold", "bg-gold"],
  ["red", "bg-system-red"],
  ["green", "bg-switch-on"],
  ["orange", "bg-system-orange"],
  ["indigo", "bg-system-indigo"],
  ["label", "bg-label"],
  ["label-2", "bg-label-secondary"],
  ["fill", "bg-fill"],
  ["separator", "bg-separator"],
  ["grouped", "bg-bg-grouped"],
  ["elevated", "bg-bg-elevated"],
] as const;

const typeScale = [
  ["Large Title", "text-large-title font-bold"],
  ["Title 1", "text-title-1 font-bold"],
  ["Title 2", "text-title-2 font-bold"],
  ["Title 3", "text-title-3 font-semibold"],
  ["Headline", "text-headline"],
  ["Body", "text-body"],
  ["Callout", "text-callout"],
  ["Subheadline", "text-subheadline"],
  ["Footnote", "text-footnote"],
  ["Caption 1", "text-caption-1"],
  ["Caption 2", "text-caption-2"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal as="section" className="grid gap-3">
      <h2 className="px-4 text-title-3 font-bold">{title}</h2>
      {children}
    </Reveal>
  );
}

export function DesignGallery() {
  const [theme, setTheme] = useState<Theme>("system");
  const [dir, setDir] = useState<Direction>("ltr");
  const [loading, setLoading] = useState(false);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);

  return (
    <DirectionProvider dir={dir}>
      <div
        dir={dir}
        lang={dir === "rtl" ? "ar" : "en"}
        className="min-h-dvh bg-bg-grouped pb-safe-16"
      >
        <NavBar
          title="Design System"
          largeTitle
          trailing={
            <IconButton
              label="Show a toast"
              size="sm"
              variant="plain"
              onClick={() => toast("Hello from the toolbar")}
            >
              <Bell />
            </IconButton>
          }
        />

        <main className="mx-auto grid max-w-(--content-max) gap-9 px-safe-4 pt-2">
          <div className="grid gap-3 px-4 sm:grid-cols-2">
            <SegmentedControl
              aria-label="Appearance"
              block
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onValueChange={setTheme}
            />
            <SegmentedControl
              aria-label="Direction"
              block
              options={[
                { value: "ltr", label: "LTR" },
                { value: "rtl", label: "RTL · عربي" },
              ]}
              value={dir}
              onValueChange={setDir}
            />
          </div>

          <Section title="Color">
            <div className="grid grid-cols-4 gap-3 px-4 sm:grid-cols-6">
              {swatches.map(([name, cls]) => (
                <div key={name} className="grid gap-1.5 text-center">
                  <span
                    className={`aspect-square rounded-lg ring-1 ring-separator ring-inset ${cls}`}
                  />
                  <span className="text-caption-1 text-label-secondary">{name}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Typography">
            <Card className="grid gap-1 p-4">
              {typeScale.map(([name, cls]) => (
                <p key={name} className={`truncate ${cls}`}>
                  {dir === "rtl" ? "مكة المكرمة" : name}
                </p>
              ))}
            </Card>
          </Section>

          <Section title="Buttons">
            <Card className="grid gap-4 p-4">
              <div className="flex flex-wrap gap-2">
                <Button>Filled</Button>
                <Button variant="tinted">Tinted</Button>
                <Button variant="gray">Gray</Button>
                <Button variant="plain">Plain</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="sm" variant="tinted">
                  <Plus /> Add
                </Button>
                <Button variant="destructive-tinted">
                  <Trash2 /> Delete
                </Button>
                <IconButton label="Share">
                  <Share />
                </IconButton>
                <IconButton label="Favorite" variant="tinted" size="sm">
                  <Star />
                </IconButton>
                <Spinner />
              </div>
              <Button
                size="lg"
                shape="rounded"
                block
                loading={loading}
                onClick={() => {
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                    toast.success("Request sent", { description: "Momen will reply shortly." });
                  }, 1500);
                }}
              >
                Request a quote
              </Button>
              <Button size="lg" shape="rounded" block variant="gray" disabled>
                Disabled
              </Button>
            </Card>
          </Section>

          <Section title="Lists">
            <ListSection header="Contact" footer="Replies within one business day.">
              <ListItem
                title="WhatsApp"
                subtitle={<bdi dir="ltr">+966 12 345 6789</bdi>}
                href="#"
                leading={
                  <ListIcon color="green">
                    <Phone />
                  </ListIcon>
                }
              />
              <ListItem
                title="Email"
                detail={<bdi dir="ltr">sales@</bdi>}
                href="#"
                leading={
                  <ListIcon color="blue">
                    <Mail />
                  </ListIcon>
                }
              />
              <ListItem
                title="Location"
                detail="Makkah"
                leading={
                  <ListIcon color="red">
                    <MapPin />
                  </ListIcon>
                }
              />
              <ListItem
                title="Notifications"
                leading={
                  <ListIcon color="orange">
                    <Bell />
                  </ListIcon>
                }
                trailing={
                  <Switch aria-label="Notifications" checked={notify} onCheckedChange={setNotify} />
                }
              />
            </ListSection>
            <ListSection>
              <ListItem
                title="Language"
                detail="English"
                onClick={() => toast("Language picker")}
                leading={
                  <ListIcon color="indigo">
                    <Globe />
                  </ListIcon>
                }
              />
              <ListItem
                title="Remove image"
                tone="destructive"
                onClick={() =>
                  toast.error("Image is in use", { description: "Remove it from the room first." })
                }
              />
            </ListSection>
          </Section>

          <Section title="Cards & media">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card variant="elevated" interactive>
                <MediaImage
                  source={demoImage(200)}
                  alt="Kaaba view room"
                  sizes="(min-width: 40rem) 20rem, 100vw"
                />
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Kaaba View Suite</CardTitle>
                    <Badge tone="gold">
                      <Sparkles /> Signature
                    </Badge>
                  </div>
                  <CardDescription>King bed · 64 m² · Haram view</CardDescription>
                </CardHeader>
                <CardFooter className="pt-3">
                  <Button size="sm" variant="tinted">
                    <BedDouble /> Details
                  </Button>
                </CardFooter>
              </Card>
              <Card variant="elevated">
                <div className="relative aspect-[3/2]">
                  <MediaImage source={demoImage(30)} alt="" fill />
                  <div className="absolute inset-x-3 bottom-3">
                    <Card variant="glass" className="flex items-center gap-3 p-3">
                      <UtensilsCrossed className="size-5 text-gold" aria-hidden />
                      <span className="text-subheadline font-semibold">Al Diwan Restaurant</span>
                    </Card>
                  </div>
                </div>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge>Buffet</Badge>
                  <Badge tone="green">Open now</Badge>
                  <Badge tone="gray">Level 2</Badge>
                  <Badge tone="red" solid>
                    Ramadan
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Controls">
            <Card className="grid gap-4 p-4">
              <SegmentedControl
                aria-label="Room type"
                options={[
                  { value: "rooms", label: "Rooms" },
                  { value: "suites", label: "Suites" },
                  { value: "dining", label: "Dining" },
                ]}
              />
              <TextField
                label="Agency name"
                placeholder="Al Noor Travel"
                autoComplete="organization"
              />
              <TextField
                label="Email"
                type="email"
                defaultValue="agent@"
                error="Enter a valid email address"
              />
              <Textarea label="Message" hint="Group size, dates and room preferences." />
            </Card>
          </Section>

          <Section title="People">
            <Card className="flex items-center gap-4 p-4">
              <Avatar name="Momen Al Harbi" size="lg" />
              <div className="grid min-w-0 flex-1">
                <span className="text-headline">Momen Al Harbi</span>
                <span className="text-subheadline text-label-secondary">Director of Sales</span>
              </div>
              <Avatar name="مؤمن الحربي" size="md" />
            </Card>
          </Section>

          <Section title="Disclosure & sheets">
            <Accordion type="single" collapsible>
              {[
                ["Check-in and check-out", "Check-in from 16:00, check-out until 12:00."],
                ["Group bookings", "Dedicated rates for groups of ten rooms or more."],
                ["Distance to Haram", "Steps away, with direct access to the King Abdulaziz Gate."],
              ].map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger>{q}</AccordionTrigger>
                  <AccordionContent>{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="px-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="gray" block>
                    Open sheet
                  </Button>
                </SheetTrigger>
                <SheetContent
                  title="Share profile"
                  description="Drag the handle down to dismiss."
                  footer={
                    <Button
                      size="lg"
                      shape="rounded"
                      block
                      onClick={() => toast.success("Link copied")}
                    >
                      Copy link
                    </Button>
                  }
                >
                  <ListSection className="mt-2">
                    <ListItem
                      title="WhatsApp"
                      href="#"
                      leading={
                        <ListIcon color="green">
                          <Phone />
                        </ListIcon>
                      }
                    />
                    <ListItem
                      title="Email"
                      href="#"
                      leading={
                        <ListIcon color="blue">
                          <Mail />
                        </ListIcon>
                      }
                    />
                  </ListSection>
                </SheetContent>
              </Sheet>
            </div>
          </Section>

          <Section title="Loading & states">
            <Card className="flex items-center gap-4 p-4">
              <Skeleton className="size-16 rounded-full" />
              <SkeletonText className="flex-1" />
            </Card>
            <Card>
              <EmptyState
                icon={<ImageOff />}
                title="No images yet"
                description="Upload photos of rooms and facilities to use them across the profile."
                action={<Button variant="tinted">Upload</Button>}
              />
            </Card>
            <Card>
              <ErrorState
                title="Couldn’t load the profile"
                description="Check your connection and try again."
                reference="req 9f0e888f030e18009a6d"
                onRetry={() => toast("Retrying…")}
              />
            </Card>
          </Section>
        </main>
      </div>
    </DirectionProvider>
  );
}
