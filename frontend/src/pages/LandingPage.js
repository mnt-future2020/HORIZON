import Preloader from "@/components/landing/Preloader";
import SmoothScroll from "@/components/landing/SmoothScroll";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import MissionSection from "@/components/landing/MissionSection";
import MasonryGallerySection from "@/components/landing/MasonryGallerySection";
import ArenaSplitSection from "@/components/landing/ArenaSplitSection";
import BrowseByCitySection from "@/components/landing/BrowseByCitySection";
import TurfTechSection from "@/components/landing/TurfTechSection";
import ArenaShowcase from "@/components/landing/ArenaShowcase";
import ArenaCalloutSection from "@/components/landing/ArenaCalloutSection";
import { HistoricalResultsAccordion } from "@/components/landing/HistoricalResultsAccordion";
import SocialSection from "@/components/landing/SocialSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <>
      <Preloader />
      <SmoothScroll>
        <main className="relative">
          <LandingHeader />
          <HeroSection />
          <div className="relative z-10">
            <MissionSection />
            <MasonryGallerySection />
            <ArenaSplitSection />
            <BrowseByCitySection />
            <TurfTechSection />
            <div className="relative w-full h-[60px] md:h-[80px] bg-[#0a0c0a]" />
            <ArenaShowcase />
            <div className="relative w-full h-[60px] md:h-[80px] bg-[#0a0c0a]" />
            <ArenaCalloutSection />
            <HistoricalResultsAccordion />
            <SocialSection />
            <LandingFooter />
          </div>
        </main>
      </SmoothScroll>
    </>
  );
}
