import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { useDocumentMeta } from "@/hooks/use-document-meta";

export default function Privacy() {
  useDocumentMeta({ title: "Privacy", description: "How the Kine Fractal site handles your data." });
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      <div className="container px-4 md:px-6 mx-auto py-24 max-w-4xl">
        <h1 className="text-3xl font-bold uppercase mb-8 text-white">Privacy Policy</h1>
        
        <div className="p-12 border border-white/10 bg-white/5 text-center">
          <h2 className="text-xl font-mono text-primary mb-4">CONTENT PENDING</h2>
          <p className="text-muted-foreground font-mono text-sm">
            The privacy policy is currently being drafted. Please check back later.
          </p>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
