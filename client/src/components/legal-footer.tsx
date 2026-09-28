import { Link } from "wouter";

export function LegalFooter() {
  return (
    <div className="mt-12 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest space-y-4">
      <p className="text-center">© 2025 Kine Fractal Accumulator. All systems nominal.</p>
      
      <div className="max-w-2xl mx-auto leading-relaxed border-t border-white/5 pt-4 mt-4">
        <p className="mb-2">
          Educational content only. Not investment, financial, or trading advice. Past performance does not guarantee future results. Trading involves substantial risk of loss. Consult a licensed financial advisor.
        </p>
        <div className="flex justify-center gap-4 text-primary/50">
          <Link href="/legal/disclaimer"><span className="hover:text-primary cursor-pointer transition-colors">Full Disclaimer</span></Link>
          <span>|</span>
          <Link href="/legal/privacy"><span className="hover:text-primary cursor-pointer transition-colors">Privacy</span></Link>
        </div>
      </div>
    </div>
  );
}
