import { useRef, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import AdminPanel from "./AdminPanel";

interface FeedItem {
  id: number;
  type: "info" | "summary" | "autonomous";
  text: string;
}

const cognitiveData = [
  { subject: "Creativity", A: 85, fullMark: 100 },
  { subject: "Logic", A: 92, fullMark: 100 },
  { subject: "Deduction", A: 78, fullMark: 100 },
  { subject: "Adaptability", A: 88, fullMark: 100 },
  { subject: "Ethics", A: 95, fullMark: 100 },
];

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      type="button"
      onClick={() => onChange(!checked)}
      className={`aether-toggle ${checked ? "active" : ""}`}
    >
      <span className="aether-toggle-knob" />
    </button>
  );
}

export default function AetheriumToolsPanel() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isAutonomous, setIsAutonomous] = useState(false);
  const [evolutionFocuses, setEvolutionFocuses] = useState<string[]>([
    "AI Ethics & Governance",
    "Quantum Computing",
    "Synthetic Biology",
    "",
  ]);
  const focusIndexRef = useRef(0);

  const addFeedItem = (item: Omit<FeedItem, "id">) => {
    setFeed((prev) => [...prev.slice(-30), { ...item, id: Date.now() + Math.random() }]);
  };

  const handleFocusChange = (index: number, value: string) => {
    const next = [...evolutionFocuses];
    next[index] = value;
    setEvolutionFocuses(next);
  };

  const handleManualAnalyze = () => {
    if (!query.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    addFeedItem({ type: "info", text: `Analyzing query: \"${query}\"...` });

    window.setTimeout(() => {
      addFeedItem({
        type: "summary",
        text: `Summary generated for \"${query}\" in offline simulation mode.`,
      });
      setIsLoading(false);
      setQuery("");
    }, 850);
  };

  const handleAutonomousToggle = (checked: boolean) => {
    setIsAutonomous(checked);
    if (!checked) {
      addFeedItem({ type: "info", text: "Autonomous evolution disabled." });
      return;
    }

    const activeFocuses = evolutionFocuses.filter((focus) => focus.trim());
    if (activeFocuses.length === 0) {
      addFeedItem({ type: "info", text: "Autonomous evolution paused. Add at least one focus." });
      setIsAutonomous(false);
      return;
    }

    const target = activeFocuses[focusIndexRef.current % activeFocuses.length];
    focusIndexRef.current += 1;
    addFeedItem({
      type: "autonomous",
      text: `[AUTONOMOUS] Scanning for new data on ${target}...`,
    });
  };

  return (
    <section className="aether-tools-grid">
      <article className="aether-card">
        <header>
          <h3>Ethical Crawler Control</h3>
        </header>
        <div className="aether-tools-column">
          <div className="aether-focus-box">
            <label>Evolution Focuses:</label>
            <div className="aether-focus-list">
              {evolutionFocuses.map((focus, index) => (
                <input
                  key={`${focus}-${index}`}
                  type="text"
                  value={focus}
                  onChange={(event) => handleFocusChange(index, event.target.value)}
                  placeholder={`Focus ${index + 1}...`}
                  disabled={isAutonomous}
                />
              ))}
            </div>
          </div>

          <div className="aether-autonomous-row">
            <span>Autonomous Evolution</span>
            <ToggleSwitch checked={isAutonomous} onChange={handleAutonomousToggle} />
          </div>

          <div className="aether-analyze-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleManualAnalyze()}
              placeholder="Enter URL or query for manual analysis..."
              disabled={isLoading}
            />
            <button type="button" onClick={handleManualAnalyze} disabled={isLoading}>
              {isLoading ? "ANALYZING..." : "ANALYZE"}
            </button>
          </div>

          <div className="aether-feed-box">
            <p>Live Feed:</p>
            {feed.length === 0 ? <p className="muted">No events yet.</p> : null}
            {feed.map((item) => (
              <p
                key={item.id}
                className={`aether-feed-item ${item.type === "autonomous" ? "autonomous" : ""}`}
              >
                {`> ${item.text}`}
              </p>
            ))}
          </div>
        </div>
      </article>

      <article className="aether-card">
        <header>
          <h3>Cognitive Profile</h3>
        </header>
        <div className="aether-radar-box">
          <ResponsiveContainer>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={cognitiveData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "none" }} axisLine={false} />
              <Radar
                name="Cognitive Reasoning"
                dataKey="A"
                stroke="#f472b6"
                fill="#f472b6"
                fillOpacity={0.6}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="aether-card">
        <header>
          <h3>System Integration</h3>
        </header>
        <div className="aether-meter-stack">
          <div className="meter-cpu">
            <div className="aether-meter-head"><span>CPU Core</span><span>72%</span></div>
            <div className="aether-meter-track"><div style={{ width: "72%" }} /></div>
          </div>
          <div className="meter-gpu">
            <div className="aether-meter-head"><span>GPU Tensor</span><span>45%</span></div>
            <div className="aether-meter-track"><div style={{ width: "45%" }} /></div>
          </div>
          <div className="meter-ram">
            <div className="aether-meter-head"><span>RAM Synapse</span><span>64%</span></div>
            <div className="aether-meter-track"><div style={{ width: "64%" }} /></div>
          </div>
          <div className="aether-dropzone">
            <p>Drag files here to process</p>
            <p>(Documents, Images, Code)</p>
          </div>
        </div>
      </article>

      <div className="aether-tools-admin-wrap">
        <AdminPanel />
      </div>
    </section>
  );
}
