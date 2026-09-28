import { Navbar } from "@/components/navbar";
import { ConfluenceScorer } from "@/components/playbook/confluence-scorer";
import { LegalFooter } from "@/components/legal-footer";

export default function DebugConfluence() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="container px-4 md:px-6 mx-auto py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">DEBUG: Confluence Scorer</h1>
          <p className="text-muted-foreground">Interactive testing component</p>
        </div>

        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
          <ConfluenceScorer />
        </div>
        <LegalFooter />
      </div>
    </div>
  );
}
