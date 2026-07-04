export interface AetherTask {
  id: number;
  name: string;
  status: "Running" | "Queued" | "Complete" | "Error";
}

export const INITIAL_TASKS: AetherTask[] = [
  { id: 1, name: "Crawling URL: /wiki/Quantum_Entanglement", status: "Running" },
  { id: 2, name: "Processing Document: 'aetherium_whitepaper.pdf'", status: "Queued" },
  { id: 3, name: "Evolving Concepts: Cellular Automata", status: "Queued" },
  { id: 4, name: "Reticulating Splines...", status: "Complete" },
];

export interface ChartRow {
  time: string;
  stability: number;
  variance: number;
  chaos: number;
}

export const generateChartData = (): ChartRow[] => {
  const data: ChartRow[] = [];
  for (let i = 30; i >= 0; i -= 1) {
    data.push({
      time: `-${i}s`,
      stability: Math.random() * 0.2 + 0.75,
      variance: Math.random() * 0.1 + 0.05,
      chaos: Math.random() * 0.1,
    });
  }
  return data;
};

export const AETHERIUM_SPACING = {
  gapGrid: "1rem",
  panelPadding: "1rem",
  chartHeight: "18rem",
  flowHeight: "12rem",
  toolsHeight: "28rem",
} as const;
