import { Reveal } from "@/components/ui/motion";
import { HOTEL_NAME, HomeHero } from "@/features/home/home-hero";

export default function Home() {
  return (
    <main>
      <HomeHero />
      <section className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center gap-4 px-safe-6 py-24 text-center">
        <Reveal>
          <p className="text-footnote font-semibold tracking-[0.24em] text-label-secondary uppercase">
            {HOTEL_NAME}
          </p>
        </Reveal>
        <Reveal>
          <p className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your partner for stays in Makkah.
          </p>
        </Reveal>
      </section>
    </main>
  );
}
