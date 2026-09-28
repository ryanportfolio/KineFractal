import { lazy, Suspense } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { MotionConfig } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Footer } from "@/components/footer";
import { ScrollToTop } from "@/components/scroll-to-top";
import { CommandLine } from "@/components/command-line";
import { RouteTransition } from "@/components/route-transition";
import { CrtTube } from "@/components/crt-tube";

// Home ships in the main bundle (it is the landing page). Every other route is
// code-split so the homepage no longer downloads recharts, better-auth and the
// report/legal pages up front — each chunk loads on navigation.
import Home from "@/pages/home";
const NotFound = lazy(() => import("@/pages/not-found"));
const LabBoard = lazy(() => import("@/pages/lab"));
const LabReport = lazy(() => import("@/pages/lab-report"));
const About = lazy(() => import("@/pages/about"));
const Alerts = lazy(() => import("@/pages/alerts"));
const Account = lazy(() => import("@/pages/account"));
const Disclaimer = lazy(() => import("@/pages/legal/disclaimer"));
const Privacy = lazy(() => import("@/pages/legal/privacy"));
const SectorRotation = lazy(() => import("@/pages/sector-rotation"));
const RatioRelevance = lazy(() => import("@/pages/ratio-relevance"));

function Router() {
  return (
    <div>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/lab" component={LabBoard} />
        <Route path="/lab/:key" component={LabReport} />
        <Route path="/sector-rotation" component={SectorRotation} />
        <Route path="/ratio-relevance" component={RatioRelevance} />
        <Route path="/about" component={About} />
        <Route path="/alerts" component={Alerts} />
<Route path="/account" component={Account} />
        <Route path="/legal/disclaimer" component={Disclaimer} />
        {/* the terms page is retired — the disclaimer carries the legal text now */}
        <Route path="/legal/terms"><Redirect to="/legal/disclaimer" replace /></Route>
        <Route path="/legal/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </div>
  );
}

function SiteFooter() {
  const [location] = useLocation();
  const normalizedLocation = location.replace(/\/+$/, "") || "/";
  if (normalizedLocation === "/about") return null;
  return <Footer />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MotionConfig reducedMotion="never">
          <Toaster />
          <ScrollToTop />
          <CommandLine />
          <RouteTransition />
          <Router />
          <SiteFooter />
          <CrtTube />
        </MotionConfig>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
