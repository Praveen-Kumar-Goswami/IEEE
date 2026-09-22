import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { Preloader } from "@/features/landing/components/Preloader";
import { Navbar } from "@/features/landing/components/Navbar";
import { Hero } from "@/features/landing/sections/Hero";
import { Problem } from "@/features/landing/sections/Problem";
import { SystemSequence } from "@/features/landing/sections/SystemSequence";
import { LiveMonitoring } from "@/features/landing/sections/LiveMonitoring";
import { Roles } from "@/features/landing/sections/Roles";
import { Workflow } from "@/features/landing/sections/Workflow";
import { Technology } from "@/features/landing/sections/Technology";
import { Security } from "@/features/landing/sections/Security";
import { Analytics } from "@/features/landing/sections/Analytics";
import { FinalCta } from "@/features/landing/sections/FinalCta";
import { Footer } from "@/features/landing/sections/Footer";

export default function LandingPage() {
  return (
    <>
      <Preloader />
      <Atmosphere variant="landing" />
      <Navbar />
      <main id="main" className="relative z-10">
        <Hero />
        <Problem />
        <SystemSequence />
        <LiveMonitoring />
        <Roles />
        <Workflow />
        <Technology />
        <Security />
        <Analytics />
        <FinalCta />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </>
  );
}
