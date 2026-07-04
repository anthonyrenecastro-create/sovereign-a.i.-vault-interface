import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { generateChartData, type ChartRow } from "../lib/aetheriumConstants";

function AlchemicalNode({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="alchemical-node-wrap">
      <div className={`alchemical-node ${active ? "active" : ""}`}>
        <div className="alchemical-node-inner">
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

function FlowLine({ active }: { active?: boolean }) {
  return (
    <div className={`flow-line-track ${active ? "active" : ""}`}>
      <div className={`flow-line-beam ${active ? "active" : ""}`} />
    </div>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="aether-card">
      <header>
        <h3>{title}</h3>
      </header>
      <div>{children}</div>
    </article>
  );
}

export default function AetheriumCognitiveDashboard() {
  const [chartData, setChartData] = useState<ChartRow[]>(() => generateChartData());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setChartData((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          time: "now",
          stability: Math.random() * 0.2 + 0.75,
          variance: Math.random() * 0.1 + 0.05,
          chaos: Math.random() * 0.1,
        });
        return next;
      });
      setTick((current) => (current + 1) % 4);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="aether-dashboard-grid">
      <div className="aether-span-2">
        <PanelCard title="Physics Engine Monitor">
          <div className="aether-chart-box">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: "#8aa6b8", fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fill: "#8aa6b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid #0ea5e9" }} />
                <Legend />
                <Line type="monotone" dataKey="stability" stroke="#00c7ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="variance" stroke="#f472b6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="chaos" stroke="#eab308" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Core Field Visualization">
        <div className="tensor-visual-shell">
          <div className="tensor-core">
            <div className="tensor-ring" />
            <div className="tensor-ping" />
            <p>TENSOR D</p>
          </div>
        </div>
      </PanelCard>

      <div className="aether-span-3">
        <PanelCard title="Matrix Flow Graph">
          <div className="flow-graph-shell">
            <div className="flow-line-slot left">
              <FlowLine active={tick === 0} />
            </div>
            <div className="flow-line-slot right">
              <FlowLine active={tick === 1 || tick === 2} />
            </div>

            <AlchemicalNode label="Intake" active={tick === 0} />
            <AlchemicalNode label="Processing" active={tick === 1} />
            <AlchemicalNode label="Output" active={tick === 2} />
            <AlchemicalNode label="Governance" active={tick === 3} />
          </div>
        </PanelCard>
      </div>
    </section>
  );
}
