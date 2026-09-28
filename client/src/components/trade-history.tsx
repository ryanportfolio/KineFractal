import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";

// Updated with actual data from DIV_STRAT_CONFLUENCE_AMEX_VOO_2025-11-23_1763959962433.csv
// Showing the most recent trades first (reversed chronological order from the CSV snippet provided)

// Top trades sorted by P&L % descending
const trades = [
  { id: 428, type: "Exit Long", date: "2021-02-05 15:30", signal: "Sell", price: 356.39, qty: 37, profit: 5347.24, profitPct: 68.21 },
  { id: 428, type: "Entry Long", date: "2020-03-18 13:30", signal: "Buy [CAUTION]", price: 211.87, qty: 37, profit: 0, profitPct: 0 },
  
  { id: 427, type: "Exit Long", date: "2021-02-05 13:30", signal: "Sell [HTF]", price: 356, qty: 3, profit: 432.39, profitPct: 68.03 },
  { id: 427, type: "Entry Long", date: "2020-03-18 13:30", signal: "Buy [CAUTION]", price: 211.87, qty: 3, profit: 0, profitPct: 0 },
  
  { id: 426, type: "Exit Long", date: "2021-02-05 13:30", signal: "Sell [HTF]", price: 356, qty: 40, profit: 5730.4, profitPct: 67.34 },
  { id: 426, type: "Entry Long", date: "2020-03-18 11:30", signal: "Buy [CAUTION]", price: 212.74, qty: 40, profit: 0, profitPct: 0 },
  
  { id: 425, type: "Exit Long", date: "2021-02-05 13:30", signal: "Sell [HTF]", price: 356, qty: 40, profit: 5530.8, profitPct: 63.51 },
  { id: 425, type: "Entry Long", date: "2020-03-18 09:30", signal: "Buy [CAUTION]", price: 217.73, qty: 40, profit: 0, profitPct: 0 },
  
  { id: 418, type: "Exit Long", date: "2021-02-05 09:30", signal: "Sell [HTF]", price: 356.08, qty: 40, profit: 5489.6, profitPct: 62.71 },
  { id: 418, type: "Entry Long", date: "2020-03-16 15:30", signal: "Buy [CAUTION]", price: 218.84, qty: 40, profit: 0, profitPct: 0 },
  
  { id: 429, type: "Exit Long", date: "2021-02-05 15:30", signal: "Sell", price: 356.39, qty: 9, profit: 1225.98, profitPct: 61.87 },
  { id: 429, type: "Entry Long", date: "2020-03-18 15:30", signal: "Buy [CAUTION]", price: 220.17, qty: 9, profit: 0, profitPct: 0 },
  
  { id: 417, type: "Exit Long", date: "2021-02-05 09:30", signal: "Sell [HTF]", price: 356.08, qty: 39, profit: 5120.31, profitPct: 58.41 },
  { id: 417, type: "Entry Long", date: "2020-03-16 13:30", signal: "Buy [CAUTION]", price: 224.79, qty: 39, profit: 0, profitPct: 0 },
  
  { id: 421, type: "Exit Long", date: "2021-02-05 11:30", signal: "Sell [HTF]", price: 356.82, qty: 39, profit: 5107.05, profitPct: 57.98 },
  { id: 421, type: "Entry Long", date: "2020-03-16 13:30", signal: "Buy [CAUTION]", price: 225.89, qty: 39, profit: 0, profitPct: 0 },
  
  { id: 84, type: "Exit Long", date: "2013-03-01 11:30", signal: "Sell [HTF]", price: 139.34, qty: 21, profit: 758.1, profitPct: 34.97 },
  { id: 84, type: "Entry Long", date: "2011-08-10 09:30", signal: "Buy [CAUTION]", price: 103.24, qty: 21, profit: 0, profitPct: 0 },
  
  { id: 82, type: "Exit Long", date: "2013-02-28 15:30",
    signal: "Sell [HTF]",
    price: 139,
    qty: 35,
    profit: 1251.6,
    profitPct: 34.64
  },
  { id: 82, type: "Entry Long", date: "2011-08-10 09:30", signal: "Buy [CAUTION]", price: 103.24, qty: 35, profit: 0, profitPct: 0 }
];

export function TradeHistory() {
  return (
    <section className="pt-16 pb-8 bg-background border-b border-border">
      <div className="container px-4 md:px-6">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h2 className="text-2xl font-bold font-mono uppercase mb-2 text-white">
                  Public_Trade_Ledger
              </h2>
           </div>
           <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-mono transition-colors cursor-pointer">
              <Download className="w-3 h-3" />
              DOWNLOAD_CSV
           </button>
        </div>

        <div className="border border-border rounded-sm bg-card relative">
           <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
           
           <ScrollArea className="h-[32rem] w-full">
             <Table>
               <TableHeader className="sticky top-0 bg-card z-10">
                 <TableRow className="border-border hover:bg-transparent">
                   <TableHead className="text-sm font-mono text-muted-foreground w-[80px]">#</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground">TYPE</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground">DATE/TIME</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground">SIGNAL</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground text-right">PRICE</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground text-right">QTY</TableHead>
                   <TableHead className="text-sm font-mono text-muted-foreground text-right">P&L</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody className="font-mono text-sm">
                 {trades.map((trade, index) => (
                   <TableRow key={index} className="border-border/40 hover:bg-white/5 transition-colors group">
                     <TableCell className="text-muted-foreground group-hover:text-white">{trade.id}</TableCell>
                     <TableCell>
                        <Badge 
                           variant="outline" 
                           className={`border-0 rounded-none px-2 py-0.5 text-sm font-normal ${
                               trade.type.includes("Exit") 
                               ? "bg-accent/10 text-accent" 
                               : "bg-primary/10 text-primary"
                           }`}
                        >
                           {trade.type.toUpperCase()}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-muted-foreground">{trade.date}</TableCell>
                     <TableCell className="text-white">{trade.signal}</TableCell>
                     <TableCell className="text-right text-white">${trade.price.toFixed(2)}</TableCell>
                     <TableCell className="text-right text-muted-foreground">{trade.qty}</TableCell>
                     <TableCell className="text-right">
                        {trade.profit > 0 ? (
                            <span className="text-primary">
                                +${trade.profit.toFixed(2)} ({trade.profitPct.toFixed(2)}%)
                            </span>
                        ) : trade.profit < 0 ? (
                            <span className="text-red-500">
                                -${Math.abs(trade.profit).toFixed(2)} ({trade.profitPct.toFixed(2)}%)
                            </span>
                        ) : (
                            <span className="text-muted-foreground">-</span>
                        )}
                     </TableCell>
                   </TableRow>
                 ))}
                 {/* Fading effect for "more trades" */}
                 <TableRow className="border-0">
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground/50 bg-gradient-to-b from-transparent to-card">
                       ... LOAD MORE 800+ ENTRIES ...
                    </TableCell>
                 </TableRow>
               </TableBody>
             </Table>
           </ScrollArea>
        </div>
      </div>
    </section>
  );
}
