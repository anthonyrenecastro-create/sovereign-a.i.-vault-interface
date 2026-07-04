
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Card from './Card';
import { generateChartData } from '../constants';

const AlchemicalNode: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
    <div className="relative flex flex-col items-center">
        <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${active ? 'border-cyan-400 cyan-glow animate-pulse' : 'border-slate-600'}`}>
            <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${active ? 'border-cyan-500/50' : 'border-slate-700'}`}>
                <span className="font-orbitron text-xs">{label}</span>
            </div>
        </div>
    </div>
);

const FlowLine: React.FC<{ from: string; to: string; active?: boolean }> = ({ active }) => (
  <div className={`absolute h-0.5 w-full top-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-slate-500 to-transparent transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-20'}`}>
      <div className={`absolute h-full w-full top-0 left-0 bg-cyan-400 transition-transform duration-1000 ${active ? 'animate-flow' : ''}`}></div>
      <style>{`
        @keyframes flow {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: left; }
          51% { transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
        .animate-flow { animation: flow 2s ease-in-out infinite; }
      `}</style>
  </div>
);

const CognitiveDashboard: React.FC = () => {
    const [chartData, setChartData] = useState(generateChartData());
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setChartData(prevData => {
                const newData = [...prevData.slice(1)];
                newData.push({
                    time: `now`,
                    stability: Math.random() * 0.2 + 0.75,
                    variance: Math.random() * 0.1 + 0.05,
                    chaos: Math.random() * 0.1,
                });
                return newData;
            });
            setTick(t => (t + 1) % 4);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn">
            <div className="lg:col-span-2">
                <Card title="Physics Engine Monitor">
                    <div className="h-72 w-full">
                        <ResponsiveContainer>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[0, 1]} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                                <Legend />
                                <Line type="monotone" dataKey="stability" stroke="#00c7ff" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="variance" stroke="#f472b6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="chaos" stroke="#eab308" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
            <Card title="Core Field Visualization">
                <div className="h-72 w-full flex items-center justify-center bg-black/20 rounded-md overflow-hidden">
                    <div className="w-48 h-48 rounded-full bg-slate-900 relative flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-spin" style={{animationDuration: '10s'}}></div>
                        <div className="absolute inset-2 border border-cyan-500/20 rounded-full animate-ping"></div>
                        <p className="font-orbitron text-cyan-400">TENSOR D</p>
                    </div>
                </div>
            </Card>

            <div className="lg:col-span-3">
                 <Card title="Matrix Flow Graph">
                    <div className="h-48 flex items-center justify-around relative bg-black/20 rounded-md p-4">
                        <div className="absolute left-1/4 w-1/4 h-full"><FlowLine active={tick === 0} /></div>
                        <div className="absolute left-2/4 w-1/4 h-full"><FlowLine active={tick === 1 || tick === 2} /></div>

                        <AlchemicalNode label="Intake" active={tick === 0} />
                        <AlchemicalNode label="Processing" active={tick === 1} />
                        <AlchemicalNode label="Output" active={tick === 2} />
                        <AlchemicalNode label="Governance" active={tick === 3} />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CognitiveDashboard;
