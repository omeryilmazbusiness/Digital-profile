"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * The one place GSAP plugins are registered; import gsap from here so they always are.
 * ignoreMobileResize: mobile browser bars showing and hiding resize the viewport while
 * scrolling; recalculating every trigger then would make pinned sections jump.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, useGSAP };
