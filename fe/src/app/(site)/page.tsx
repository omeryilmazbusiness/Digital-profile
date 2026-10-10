import { getSiteContent } from "@/features/site/content";
import { LandingPage } from "@/features/site/landing-page";

export default async function Home() {
  return <LandingPage content={await getSiteContent()} />;
}
