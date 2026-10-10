import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";

export default function Disclaimer() {
  useDocumentMeta({ title: "Disclaimer", description: "Educational content only, not investment advice." });
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      <div className="container px-4 md:px-6 mx-auto py-24 max-w-4xl">
        <h1 className="beam-heading mb-8" data-drawn="1">Legal Disclaimer</h1>
        
        <div className="space-y-6 text-muted-foreground font-mono text-sm leading-relaxed">
          <p className="text-xs text-primary/50 mb-6">Last Updated: November 25, 2025</p>

          <section>
            <h3 className="text-white font-bold mb-2">No Investment Advice</h3>
            <p>The information, tools, indicators, and content provided on this website are for educational and informational purposes only and do not constitute investment advice, financial advice, trading advice, or any other type of advice. Nothing on this website should be construed as a recommendation to buy, sell, or hold any security, cryptocurrency, commodity, or other financial instrument.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Not Financial Professionals</h3>
            <p>We are not registered investment advisors, broker-dealers, or financial planners. The indicators and educational materials provided are based on technical analysis concepts and should not be relied upon as the sole basis for any investment decision.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Do Your Own Research</h3>
            <p>You are solely responsible for conducting your own research and due diligence before making any trading or investment decisions. You should consult with a licensed financial advisor, accountant, and/or attorney before making any financial decisions.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Past Performance Disclaimer</h3>
            <p>Any past performance, backtesting results, or hypothetical performance shown for any indicator or strategy is not indicative of future results. Past performance does not guarantee future performance. Simulated or hypothetical trading results have inherent limitations and do not represent actual trading.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Risk of Loss</h3>
            <p>Trading and investing in financial markets involves substantial risk of loss and is not suitable for every investor. You may lose some or all of your invested capital. Never invest money you cannot afford to lose. The risk of loss in trading can be substantial.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">No Guarantees</h3>
            <p>We make no representations or warranties regarding the accuracy, completeness, reliability, or timeliness of any indicators, signals, or information provided. Technical indicators can produce false signals and are not foolproof.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Subscription Services</h3>
            <p>Our paid subscription services provide access to proprietary indicators and tools. Subscription fees are non-refundable except as required by law. Access to paid indicators does not guarantee trading success or profitability.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">No Liability</h3>
            <p>To the maximum extent permitted by law, we disclaim all liability for any losses, damages, or expenses (including but not limited to direct, indirect, incidental, consequential, or punitive damages) arising from or related to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your use of our website, indicators, or services</li>
              <li>Any trading or investment decisions made based on information from this website</li>
              <li>Technical issues, errors, or inaccuracies in indicators or content</li>
              <li>Interruption or unavailability of services</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Third-Party Data and Brokers</h3>
            <p>The figures on this site are produced by our own research engine from third-party market data. We are not affiliated with any data provider, exchange, or broker, and have no control over their platforms, fees, or services. If you place trades with a broker, you are responsible for complying with that broker's terms of service.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Regulatory Compliance</h3>
            <p>You are responsible for ensuring your use of our indicators complies with all applicable laws and regulations in your jurisdiction. Some jurisdictions have restrictions on trading certain instruments or using certain tools.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Changes to Disclaimer</h3>
            <p>We reserve the right to modify this disclaimer at any time. Continued use of our website after changes constitutes acceptance of the modified disclaimer.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">Acceptance</h3>
            <p>By using this website, accessing our indicators, or subscribing to our services, you acknowledge that you have read, understood, and agree to this disclaimer.</p>
          </section>
        </div>
      </div>
    </div>
  );
}