import SmoothScroll from "@/components/landing/SmoothScroll";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import MissionSection from "@/components/landing/MissionSection";
import ArenaSplitSection from "@/components/landing/ArenaSplitSection";
import BrowseByCitySection from "@/components/landing/BrowseByCitySection";
import PlatformFeaturesSection from "@/components/landing/PlatformFeaturesSection";
import ArenaShowcase from "@/components/landing/ArenaShowcase";
import ArenaCalloutSection from "@/components/landing/ArenaCalloutSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import SocialSection from "@/components/landing/SocialSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <>
      <SmoothScroll>
        <main className="relative">
          <LandingHeader />
          <HeroSection />
          <div className="relative z-10">
            <MissionSection />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <ArenaSplitSection />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <BrowseByCitySection />
            <PlatformFeaturesSection />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <ArenaShowcase />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <ArenaCalloutSection />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <HowItWorksSection />
            <div className="relative w-full h-[30px] sm:h-[40px] md:h-[60px] lg:h-[80px] bg-[#0a0c0a]" />
            <SocialSection />
            <LandingFooter />
          </div>
        </main>
      </SmoothScroll>
    </>
  );
}
