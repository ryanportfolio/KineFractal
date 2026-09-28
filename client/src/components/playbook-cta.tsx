import { Link } from "wouter";

export function PlaybookCTA() {
  return (
    <div className="space-y-12">
      {/* Main Playbook ASCII Button */}
      <Link href="/about">
        <div className="flex justify-center mt-8">
          <div className="group cursor-pointer bg-black border-2 border-green-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300 hover:border-green-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:scale-105">
            <pre className="font-mono text-base text-green-500/90 leading-tight whitespace-pre transition-colors duration-300 group-hover:text-green-400">
{`██████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█░█░▀█▀░█▀█░█▀▀░░░█▀▀░█▀▄░█▀█░█▀▀░▀█▀░█▀█░█░░░░░░░░░█
█░░░░░░░░█▀▄░░█░░█░█░█▀▀░░░█▀▀░█▀▄░█▀█░█░░░░█░░█▀█░█░░░░░░░░░█
█░░░░░░░░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀░░░▀░▀░▀░▀░▀▀▀░░▀░░▀░▀░▀▀▀░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
██████████████████████████████████████████████████████████████████`}
            </pre>
          </div>
        </div>
      </Link>
      <div className="flex justify-center mt-6">
        <p className="italic text-muted-foreground text-center max-w-4xl font-mono border border-green-500/30 bg-black/40 p-4 rounded text-[16px]">
          Signal fires → Weight by regime → Multiply by confluence → Filter through safety layer → Compute position size proportional to expected value
        </p>
      </div>
    </div>
  );
}
