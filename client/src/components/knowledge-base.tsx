import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, BookOpen, Lightbulb, Terminal, ListChecks, Target, Shield, Gauge, Activity, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function KnowledgeBase() {
  return (
    <section className="py-24 bg-black border-t border-white/10">
      <div className="container px-4 md:px-6">
        
        <div className="flex items-center justify-between mb-12 border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                    <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-primary/70 tracking-widest">SYSTEM_READY</span>
                    </div>
                    <h2 className="text-3xl font-mono font-bold uppercase tracking-widest text-white mt-1">
                        OPERATOR_FIELD_GUIDE
                        <span className="animate-pulse text-primary">_</span>
                    </h2>
                </div>
            </div>
            <div className="hidden md:block text-right">
                <div className="text-[10px] font-mono text-muted-foreground">ACCESS LEVEL</div>
                <div className="text-sm font-mono text-primary font-bold">UNRESTRICTED</div>
            </div>
        </div>

        <Tabs defaultValue="guide" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-white/5 border border-white/10 mb-8">
                <TabsTrigger value="guide" className="data-[state=active]:bg-primary data-[state=active]:text-black font-mono text-xs md:text-sm">HIERARCHY</TabsTrigger>
                <TabsTrigger value="indicators" className="data-[state=active]:bg-primary data-[state=active]:text-black font-mono text-xs md:text-sm">CHEAT SHEET</TabsTrigger>
                <TabsTrigger value="playbook" className="data-[state=active]:bg-primary data-[state=active]:text-black font-mono text-xs md:text-sm">PLAYBOOK</TabsTrigger>
                <TabsTrigger value="faq" className="data-[state=active]:bg-primary data-[state=active]:text-black font-mono text-xs md:text-sm">FAQ / TIPS</TabsTrigger>
            </TabsList>

            {/* HIERARCHY TAB (Order of Operations) */}
            <TabsContent value="guide" className="space-y-8">
                <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-primary" />
                        THE PILOT'S CHECKLIST
                    </h3>
                    <p className="text-muted-foreground mb-6">
                        Do not look at all 5 indicators at once. Scan them in this exact <strong>Hierarchy of Command</strong> to avoid analysis paralysis.
                    </p>
                    
                    <div className="space-y-4">
                        {[
                            { step: 1, title: "THE GOVERNOR", script: "Risk Dashboard", icon: Shield, question: "Am I allowed to trade today?", color: "text-red-400" },
                            { step: 2, title: "THE MAP", script: "Macro Data", icon: Gauge, question: "Which direction is the big river flowing?", color: "text-blue-400" },
                            { step: 3, title: "THE WEATHER", script: "Context", icon: Activity, question: "Is the wind at my back (Momentum)?", color: "text-green-400" },
                            { step: 4, title: "THE DESTINATION", script: "Structure", icon: Target, question: "Where is the bus stop (Support/Resistance)?", color: "text-yellow-400" },
                            { step: 5, title: "THE TRIGGER", script: "Lumina", icon: Terminal, question: "Open fire.", color: "text-primary" }
                        ].map((item) => (
                            <div key={item.step} className="flex items-start gap-4 bg-black/50 p-4 rounded border border-white/5 group hover:border-white/20 transition-colors">
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-mono text-xs font-bold text-white">
                                        {item.step}
                                    </div>
                                    {item.step < 5 && <div className="w-px h-8 bg-white/10 group-hover:bg-white/30 transition-colors" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white uppercase">{item.title}</h4>
                                        <span className={`text-xs font-mono ${item.color} bg-white/5 px-2 py-0.5 rounded`}>{item.script}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono">"{item.question}"</p>
                                </div>
                            </div>
                        ))}
                    </div>

                     {/* CTA to Indicator Library */}
                     <div className="mt-8 pt-8 border-t border-white/10 text-center">
                        <p className="text-muted-foreground mb-4 text-sm">
                            Need a deeper understanding of each component in the hierarchy?
                        </p>
                        <Link href="/indicator-library">
                            <button className="inline-flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold text-xs tracking-widest rounded transition-all uppercase">
                                Explore Indicator Library <ArrowRight className="w-4 h-4" />
                            </button>
                        </Link>
                     </div>
                </div>
            </TabsContent>

            {/* INDICATOR CHEAT SHEET */}
            <TabsContent value="indicators" className="space-y-6">
                
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                    <div className="relative z-10">
                        <h3 className="text-primary font-bold mb-2 flex items-center justify-center gap-2">
                            <Target className="w-5 h-5" />
                            READY FOR EXECUTION?
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-2xl mx-auto">
                            The indicators are just the tools. The Playbook is the manual. Learn the 6 specific setups used by institutional operators.
                        </p>
                        <Link href="/indicator/playbook">
                            <button className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-black font-bold text-xs tracking-widest rounded hover:bg-primary/90 transition-colors uppercase">
                                Open Operator's Playbook <ArrowRight className="w-4 h-4" />
                            </button>
                        </Link>
                    </div>
                 </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Context */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-green-400" />
                                    Context Dashboard
                                </h4>
                                <span className="text-[10px] font-mono text-muted-foreground">THE PHYSICS</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p className="mb-3">Use independently to gauge the immediate strength of the move.</p>
                                <ul className="space-y-2 text-xs font-mono">
                                    <li className="flex gap-2"><span className="text-green-500">●</span> Growing Green: Hold/Add</li>
                                    <li className="flex gap-2"><span className="text-yellow-500">●</span> Shrinking Green: Tighten stops</li>
                                    <li className="flex gap-2"><span className="text-red-500">●</span> Red: Defensive mode</li>
                                </ul>
                                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                    <strong>SPECIAL:</strong> Hindenburg Background (Red/Orange) = STOP BUYING. Structural fracture detected.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Structure */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <Target className="w-4 h-4 text-yellow-400" />
                                    Institutional Structure
                                </h4>
                                <span className="text-[10px] font-mono text-muted-foreground">THE LOCATION</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p className="mb-3">Use to find where to place Limit Orders.</p>
                                <ul className="space-y-2 text-xs font-mono">
                                    <li className="flex gap-2"><span className="text-teal-500">■</span> Teal Box: Demand (Buy Zone)</li>
                                    <li className="flex gap-2"><span className="text-red-500">■</span> Red Box: Supply (Sell Zone)</li>
                                    <li className="flex gap-2"><span className="text-white">□</span> Solid Border: Fresh (Strong)</li>
                                </ul>
                                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                                    <strong>SPECIAL:</strong> "SWEEP" Label = Highest Probability. Means liquidity was grabbed.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Macro */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-blue-400" />
                                    Macro Truth-Teller
                                </h4>
                                <span className="text-[10px] font-mono text-muted-foreground">THE TREND</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p className="mb-3">Prevents shorting bull markets or buying bear markets.</p>
                                <ul className="space-y-2 text-xs font-mono">
                                    <li className="flex gap-2"><span className="text-purple-400">↗</span> Price &gt; Purple Line: Bull bias (Buy Dips)</li>
                                    <li className="flex gap-2"><span className="text-purple-400">↘</span> Price &lt; Purple Line: Bear bias (Sell Rallies)</li>
                                </ul>
                                <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">
                                    <strong>SPECIAL:</strong> Gold Fib Lines = Mathematically cheap areas.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risk */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-red-400" />
                                    Risk Dashboard
                                </h4>
                                <span className="text-[10px] font-mono text-muted-foreground">THE PERMISSION</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p className="mb-3">Determines Position Size.</p>
                                <ul className="space-y-2 text-xs font-mono">
                                    <li className="flex gap-2"><span className="text-green-500">●</span> INVEST: Full Size</li>
                                    <li className="flex gap-2"><span className="text-yellow-500">●</span> CHOP: Half Size (Take profits early)</li>
                                    <li className="flex gap-2"><span className="text-red-500">●</span> WARN: Cash or Hedge</li>
                                </ul>
                                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                    <strong>SPECIAL:</strong> Risk Score &gt; 75 = Expect a Crash.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </TabsContent>

            {/* PLAYBOOK TAB */}
            <TabsContent value="playbook" className="space-y-6">
                 <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg text-center mb-8 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                    <div className="relative z-10">
                        <h3 className="text-primary font-bold mb-2 flex items-center justify-center gap-2">
                            <BookOpen className="w-5 h-5" />
                            THE OPERATOR'S PLAYBOOK
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-2xl mx-auto">
                            Access the complete 4-layer decision framework, visual checklists, and execution protocols in the full system guide.
                        </p>
                        <Link href="/indicator/playbook">
                            <button className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-black font-bold text-xs tracking-widest rounded hover:bg-primary/90 transition-colors uppercase">
                                Open Full Field Guide <ArrowRight className="w-4 h-4" />
                            </button>
                        </Link>
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-center mb-8">
                    <h3 className="text-white font-bold mb-2 text-sm uppercase tracking-widest">Quick Reference: The Golden Rule</h3>
                    <p className="text-sm text-muted-foreground">
                        Never take a Script 5 (Lumina) entry signal unless Script 2 (Structure) says you are in a Zone. 
                        <br/>
                        <strong>Context and Structure must agree before you pull the Trigger.</strong>
                    </p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Setup A */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-primary/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP A</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Royal Flush"</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Environment</span>
                                <span className="text-green-500 font-mono">INVEST / CHOP</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Location</span>
                                <span className="text-teal-500 font-mono">Teal Demand Zone</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trend</span>
                                <span className="text-purple-400 font-mono">Above Q20 Line</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trigger</span>
                                <span className="text-green-500 font-mono">Green Flash</span>
                            </div>
                            <div className="mt-4 bg-green-500/20 text-green-400 p-2 text-center font-bold rounded">
                                ACTION: MAX SIZE BUY
                            </div>
                        </div>
                    </div>

                    {/* Setup B */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-blue-400/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP B</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Power Trend"</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Environment</span>
                                <span className="text-green-500 font-mono">POWER TREND</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Location</span>
                                <span className="text-blue-400 font-mono">Tests Blue M5 Line</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trend</span>
                                <span className="text-white font-mono">Momentum Scalp</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trigger</span>
                                <span className="text-yellow-400 font-mono">"H" (Hidden) Label</span>
                            </div>
                            <div className="mt-4 bg-blue-500/20 text-blue-400 p-2 text-center font-bold rounded">
                                ACTION: ADD TO WINNERS
                            </div>
                        </div>
                    </div>

                    {/* Setup C */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-accent/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP C</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Bear Trap"</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Environment</span>
                                <span className="text-orange-500 font-mono">Hindenburg Background</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Conflict</span>
                                <span className="text-green-500 font-mono">Credit is SUPPORTIVE</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Logic</span>
                                <span className="text-white font-mono">Shakeout (Fake Crash)</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trigger</span>
                                <span className="text-blue-400 font-mono">Aqua Acceleration Line</span>
                            </div>
                            <div className="mt-4 bg-orange-500/20 text-orange-400 p-2 text-center font-bold rounded">
                                ACTION: BUY THE BLOOD
                            </div>
                        </div>
                    </div>

                    {/* Setup D */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-red-500/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP D</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Crash"</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Environment</span>
                                <span className="text-red-500 font-mono">Risk Score &gt; 75</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Signal</span>
                                <span className="text-yellow-500 font-mono">⚠️ FEAR SPIKE</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Visual</span>
                                <span className="text-red-500 font-mono">Background Turns Red</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Action</span>
                                <span className="text-white font-mono">Close All Longs</span>
                            </div>
                            <div className="mt-4 bg-red-500/20 text-red-400 p-2 text-center font-bold rounded">
                                ACTION: GET OUT IMMEDIATELY
                            </div>
                        </div>
                    </div>

                    {/* Setup E */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-purple-400/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP E</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Ceiling" (Take Profit)</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Location</span>
                                <span className="text-red-500 font-mono">Red Supply Zone</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Weakness</span>
                                <span className="text-pink-400 font-mono">Bearish Divergence (Red R)</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Momentum</span>
                                <span className="text-yellow-500 font-mono">Velocity Turning Grey</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Logic</span>
                                <span className="text-white font-mono">Buyers are Exhausted</span>
                            </div>
                            <div className="mt-4 bg-purple-500/20 text-purple-400 p-2 text-center font-bold rounded">
                                ACTION: PROTECT / TRAIL STOP
                            </div>
                        </div>
                    </div>

                    {/* Setup F */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-teal-400/50 transition-colors">
                        <div className="text-xs font-mono text-muted-foreground mb-2">SETUP F</div>
                        <h4 className="text-xl font-bold text-white mb-4">The "Zone Flip" (Breakout)</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Event</span>
                                <span className="text-white font-mono">Close ABOVE Red Supply</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Confirmation</span>
                                <span className="text-green-500 font-mono">Velocity Stays Green</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Physics</span>
                                <span className="text-blue-400 font-mono">Escape Velocity Achieved</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span>Trigger</span>
                                <span className="text-teal-500 font-mono">Re-test of Old Supply</span>
                            </div>
                            <div className="mt-4 bg-teal-500/20 text-teal-400 p-2 text-center font-bold rounded">
                                ACTION: BUY THE RE-TEST
                            </div>
                        </div>
                    </div>
                 </div>
            </TabsContent>

            {/* FAQ / TIPS TAB */}
            <TabsContent value="faq">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* FAQ Column */}
                    <div className="space-y-4">
                        <h3 className="font-mono text-sm text-primary uppercase mb-4">Frequently Asked Questions</h3>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-grid" className="border border-white/10 bg-white/5 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 text-left">
                                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-mono text-sm text-white">Is this a Grid Bot?</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 pl-7">
                                    <p className="mb-2">
                                        <strong className="text-white">No. Grid bots buy blindly. We buy on Signal.</strong>
                                    </p>
                                    Grid bots add risk when you are wrong. We accumulate only when physics confirms a reversal (Divergence + Momentum). It accumulates *like* a grid to average price, but thinks like a sniper.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-repaint" className="border border-white/10 bg-white/5 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 text-left">
                                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-mono text-sm text-white">Does it Repaint?</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 pl-7">
                                    <p className="mb-2">
                                        <strong className="text-white">Zero Repainting.</strong>
                                    </p>
                                    If a candle closes with a signal, it is locked forever. We use "Bar Magnifier" technology to ensure backtest accuracy matches live execution tick-for-tick.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-pyramid" className="border border-white/10 bg-white/5 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 text-left">
                                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-mono text-sm text-white">Why 250 Pyramiding Orders?</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 pl-7">
                                    <p className="mb-2">
                                        <strong className="text-white">Micro-Sizing reduces Timing Risk.</strong>
                                    </p>
                                    Instead of 1 "All-In" entry, we make up to 250 entries that averages our entry price across the entire trend, making "perfect timing" irrelevant. We buy the *flow*, not the *price*.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-bottom" className="border border-white/10 bg-white/5 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 text-left">
                                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-mono text-sm text-white">Why not buy the exact bottom?</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 pl-7">
                                    <p className="mb-2">
                                        <strong className="text-white">It's a feature, not a bug.</strong>
                                    </p>
                                    We wait for "Positive Velocity" before entering. We don't catch falling knives. This costs us the first ~2 candles but saves us from V-Shape vs L-Shape crashes.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>

                    {/* Tips Column */}
                    <div className="space-y-4">
                        <h3 className="font-mono text-sm text-primary uppercase mb-4">Pro Tips</h3>
                        
                        <div className="border-l-2 border-accent bg-white/5 p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-accent" />
                                <h4 className="font-mono font-bold text-white text-sm">TRUST THE PYRAMIDING</h4>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Do not manually close positions just because you see a small profit. The strategy relies on layering 10-20 micro-positions to build a massive average price. Let the "Sell Logic" handle the exit.
                            </p>
                        </div>

                        <div className="border-l-2 border-primary bg-white/5 p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Terminal className="w-4 h-4 text-primary" />
                                <h4 className="font-mono font-bold text-white text-sm">IGNORE INTRA-BAR NOISE</h4>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                This strategy works on <span className="text-white font-bold">ANY TIMEFRAME</span>, but the <span className="text-primary font-bold border-b border-primary">2H TIMEFRAME</span> is strictly recommended. It has the <strong>best backtested performance</strong> for many tickers using default settings.
                                <br/><br/>
                                <strong>The Rule:</strong> If the candle hasn't closed, the signal isn't real. A "divergence" might appear at 10:30 AM and vanish by 12:00 PM. Never trade intra-bar. Higher timeframes = Fewer signals, higher quality.
                            </p>
                        </div>
                        
                        <div className="border-l-2 border-blue-400 bg-white/5 p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-blue-400" />
                                <h4 className="font-mono font-bold text-white text-sm">THE "WAIT" PHASE</h4>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                After a sell-off, the strategy might go silent for weeks. This is the "Trap Logic" working. It is avoiding the chop. Do not force a trade during low-velocity periods.
                            </p>
                        </div>
                    </div>
                </div>
            </TabsContent>

        </Tabs>

      </div>
    </section>
  );
}

