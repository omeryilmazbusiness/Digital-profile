import { ScrollCanvasVideo, type Scene } from "@/components/scroll/scroll-canvas-video";
import { SceneStory } from "@/components/scroll/scene-story";
import { Handwriting } from "@/components/signature/handwriting";
import type { HomeHero as HomeHeroContent, SiteCredit } from "@/features/site/content";
import { Credit } from "@/features/site/credit";
import type { UiStrings } from "@/i18n/ui";

import { heroFrames } from "./hero-frames.gen";
import { hotelSignatures } from "./hotel-signature.gen";

interface HomeHeroProps {
  locale: string;
  hotelName: string;
  hero: HomeHeroContent;
  ui: UiStrings;
  credit?: SiteCredit;
}

const heroScenes = ({ locale, hotelName, hero, ui, credit }: HomeHeroProps): readonly Scene[] => [
  {
    id: "arrival",
    start: 0,
    end: 0.2,
    align: "center",
    content: (
      <div className="relative flex w-full flex-col items-center text-center text-white">
        {/* Keeps the white ink legible over bright footage; leaves with the scene. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-[40vw] -inset-y-32 bg-[radial-gradient(closest-side,rgb(0_0_0/0.62),rgb(0_0_0/0.3)_55%,transparent)]"
        />
        <p className="relative text-caption-1 font-medium tracking-[0.42em] text-white/75 uppercase">
          {ui.welcomeTo}
        </p>
        <h1 className="sr-only">{hotelName}</h1>
        <Handwriting
          // The page's own language is written first.
          signatures={hotelSignatures.toSorted(
            (a, b) => +(b.lang === locale) - +(a.lang === locale),
          )}
          className="relative mt-6 w-[min(88vw,46rem)]"
        />
        <p className="relative mt-8 max-w-xs text-subheadline text-pretty text-white/80 sm:max-w-sm sm:text-body">
          {hero.lead}
        </p>
        <ScrollHint label={ui.scroll} />
        <Credit credit={credit} ui={ui} tone="light" className="relative mt-8" />
      </div>
    ),
  },
  ...hero.scenes.slice(0, 2).map((scene, i): Scene => ({
    id: i === 0 ? "welcome" : "lobby",
    start: i === 0 ? 0.3 : 0.6,
    end: i === 0 ? 0.5 : 0.9,
    ...(i === 0 ? { align: "center" as const } : {}),
    content: (
      <SceneStory
        index={String(i + 1).padStart(2, "0")}
        eyebrow={scene.eyebrow}
        title={scene.title}
        {...(i === 1 ? { align: "start" as const } : {})}
      >
        <p>{scene.body}</p>
      </SceneStory>
    ),
  })),
];

/**
 * The home page opening: the hotel name writes itself over the studio's signature, then the walk
 * into the lobby.
 */
export function HomeHero(props: HomeHeroProps) {
  return (
    <div data-header-overlay="">
      <ScrollCanvasVideo
        sequence={heroFrames}
        scenes={heroScenes(props)}
        label={props.hero.film}
        loadingLabel={props.ui.loading}
        length={4}
        scrub={0.5}
      />
    </div>
  );
}

function ScrollHint({ label }: { label: string }) {
  return (
    <div aria-hidden className="relative mt-12 flex flex-col items-center gap-3">
      <span className="text-caption-2 font-medium tracking-[0.32em] text-white/60 uppercase">
        {label}
      </span>
      <span className="relative h-12 w-px overflow-hidden bg-white/20">
        <span className="absolute inset-x-0 top-0 h-1/2 animate-scroll-hint bg-linear-to-b from-transparent to-white" />
      </span>
    </div>
  );
}
