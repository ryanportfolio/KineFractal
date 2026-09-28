import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, Activity, RefreshCw } from "lucide-react";

const STEPS = [
  { id: "scan", label: "SCANNING_PRICE_ACTION", duration: 2000 },
  { id: "div", label: "DIVERGENCE_DETECTED", duration: 1500 },
  { id: "physics", label: "CALCULATING_PHYSICS", duration: 2000 },
  { id: "decision", label: "EXECUTING_LOGIC", duration: 1500 }
];

export function SignalProcessorSimulation() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  
  // Scenario: 0 = Safe Buy, 1 = Trap Blocked
  const isTrapScenario = cycle % 2 !== 0;

  useEffect(() => {
    const currentStep = STEPS[step];
    const timer = setTimeout(() => {
      if (step < STEPS.length - 1) {
        setStep(s => s + 1);
      } else {
        // Reset
        setTimeout(() => {
          setStep(0);
          setCycle(c => c + 1);
        }, 3000);
      }
    }, currentStep.duration);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className="border border-white/10 bg-black p-6 relative overflow-hidden min-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
        <div className="flex-1">
           <pre className="font-mono text-xs text-primary/90 leading-tight whitespace-pre">
{`█████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█░░░█▀█░█▀▀░▀█▀░█▀▀░░░█▀▀░▀█▀░█▄█░░░░░░░░░░░█
█░░░░░░░░█░░░█░█░█░█░░█░░█░░░░░▀▀█░░█░░█░█░░░░░░░░░░░█
█░░░░░░░░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░░░▀▀▀░▀▀▀░▀░▀░░░░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████`}
           </pre>
        </div>
        <div className="font-mono text-sm text-muted-foreground ml-auto">
           SEQUENCE_ID: {cycle.toString().padStart(4, '0')}
        </div>
      </div>

      {/* Visualization Area */}
      <div className="flex-1 flex items-center justify-center relative">
         
         {/* Central Core */}
         <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Outer Ring */}
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
               className="absolute inset-0 border border-dashed border-white/20 rounded-full"
            />
            
            {/* Inner Ring - Reacts to state */}
            <motion.div 
               animate={{ 
                 rotate: -360,
                 borderColor: step === 2 ? (isTrapScenario ? "var(--color-destructive)" : "var(--color-primary)") : "rgba(255,255,255,0.1)"
               }}
               transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
               className="absolute inset-4 border-2 border-t-transparent border-l-transparent border-white/10 rounded-full"
            />

            {/* Status Icon / Text */}
            <div className="text-center z-10">
               <AnimatePresence mode="wait">
                 {step === 0 && (
                    <motion.div 
                        key="scan"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <RefreshCw className="w-8 h-8 text-white/50 animate-spin" />
                        <div className="text-sm font-mono text-muted-foreground">SCANNING</div>
                    </motion.div>
                 )}
                 
                 {step === 1 && (
                    <motion.div 
                        key="div"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="text-2xl font-bold text-white">RSI</div>
                        <div className="text-sm font-mono text-white bg-white/10 px-2 py-1">DIVERGENCE</div>
                    </motion.div>
                 )}

                 {step === 2 && (
                    <motion.div 
                        key="physics"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="font-mono text-sm text-muted-foreground">PHYSICS</div>
                        <div className={`text-xl font-bold font-mono ${isTrapScenario ? "text-red-500" : "text-primary"}`}>
                           {isTrapScenario ? "VEL < 0" : "VEL > 0"}
                        </div>
                    </motion.div>
                 )}

                 {step === 3 && (
                    <motion.div 
                        key="result"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center gap-2"
                    >
                        {isTrapScenario ? (
                           <>
                              <ShieldAlert className="w-10 h-10 text-red-500" />
                              <div className="text-sm font-bold text-red-500 bg-red-500/10 px-2 py-1 border border-red-500/20">TRAP BLOCKED</div>
                           </>
                        ) : (
                           <>
                              <CheckCircle2 className="w-10 h-10 text-primary" />
                              <div className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 border border-primary/20">ACCUMULATING</div>
                           </>
                        )}
                    </motion.div>
                 )}
               </AnimatePresence>
            </div>
         </div>

      </div>

      {/* Terminal Log */}
      <div className="mt-8 h-32 font-mono text-xs p-4 bg-black/40 border border-white/10 overflow-hidden flex flex-col-reverse">
         <div className="space-y-1.5">
            {step >= 0 && <div className={step > 0 ? "text-muted-foreground" : "text-white"}>&gt; INITIALIZING SCAN_PROTOCOLS... OK</div>}
            {step >= 1 && <div className={step > 1 ? "text-white" : "text-white font-semibold"}>&gt; SIGNAL_DETECTED: <span className={step > 1 ? "text-primary" : "text-primary font-bold"}>RSI_BULL_DIV_HIDDEN</span></div>}
            {step >= 2 && (
               <div className={step > 2 ? (isTrapScenario ? "text-red-400" : "text-primary") : (isTrapScenario ? "text-red-400 font-semibold" : "text-primary font-semibold")}>
                  &gt; CHECKING_PHYSICS... VEL: {isTrapScenario ? "-5.42" : "+12.8"} | ACC: {isTrapScenario ? "-0.23" : "+1.4"}
               </div>
            )}
            {step >= 3 && (
               <div className={isTrapScenario ? "text-red-500 font-bold" : "text-primary font-bold"}>
                  &gt; RESULT: {isTrapScenario ? "CRASH_DETECTED -> ORDER_CANCELLED" : "REGIME_SAFE -> BUY_ORDER_SENT"}
               </div>
            )}
            {step >= 3 && (
               <div className="text-muted-foreground animate-pulse">
                  &gt; WAITING_NEXT_TICK...
               </div>
            )}
         </div>
      </div>

    </div>
  );
}
