import { SmoothScrollProvider } from "@/components/scroll/smooth-scroll-provider";

/** The public site: smooth scrolling for its scroll-driven storytelling. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
