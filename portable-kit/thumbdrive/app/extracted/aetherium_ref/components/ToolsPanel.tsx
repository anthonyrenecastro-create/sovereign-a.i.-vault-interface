import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { searchWeb } from '../services/geminiService';
import { FeedItem } from '../types';

const cognitiveData = [
    { subject: 'Creativity', A: 85, fullMark: 100 },
    { subject: 'Logic', A: 92, fullMark: 100 },
    { subject: 'Deduction', A: 78, fullMark: 100 },
    { subject: 'Adaptability', A: 88, fullMark: 100 },
    { subject: 'Ethics', A: 95, fullMark: 100 },
];

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-magenta-500 ${checked ? 'bg-magenta-600' : 'bg-slate-700'}`}
    >
        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

const ToolsPanel: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [evolutionFocuses, setEvolutionFocuses] = useState<string[]>([
        "AI Ethics & Governance",
        "Quantum Computing",
        "Synthetic Biology",
        "",
    ]);
    const autonomousIntervalRef = useRef<number | null>(null);
    const focusIndexRef = useRef(0);
    const feedContainerRef = useRef<HTMLDivElement>(null);

    const addFeedItem = (item: Omit<FeedItem, 'id'>) => {
        setFeed(prev => [...prev.slice(-50), { ...item, id: Date.now() + Math.random() }]);
    };
    
    useEffect(() => {
        feedContainerRef.current?.scrollTo(0, feedContainerRef.current.scrollHeight);
    }, [feed]);

    const handleManualCrawl = async () => {
        if (!query.trim() || isLoading) return;
        setIsLoading(true);
        addFeedItem({ type: 'info', text: `Analyzing query: "${query}"...` });

        try {
            const result = await searchWeb(query);
            addFeedItem({ type: 'summary', text: result.summary, sources: result.sources });
        } catch (error) {
            addFeedItem({ type: 'error', text: 'A critical error occurred during analysis.' });
        } finally {
            setIsLoading(false);
            setQuery('');
        }
    };

    const handleFocusChange = (index: number, value: string) => {
        const newFocuses = [...evolutionFocuses];
        newFocuses[index] = value;
        setEvolutionFocuses(newFocuses);
    };

    useEffect(() => {
        const activeFocuses = evolutionFocuses.filter(f => f.trim() !== '');

        if (isAutonomous) {
            if (activeFocuses.length === 0) {
                 addFeedItem({ type: 'info', text: `Autonomous evolution paused. Please enter at least one focus topic to resume.` });
                 if (autonomousIntervalRef.current) {
                    clearInterval(autonomousIntervalRef.current);
                    autonomousIntervalRef.current = null;
                 }
                 return;
            }

            addFeedItem({ type: 'info', text: `Autonomous evolution enabled for: ${activeFocuses.join(', ')}. Scanning periodically...` });
            
            const performAutonomousScan = async () => {
                 const currentFocus = activeFocuses[focusIndexRef.current % activeFocuses.length];
                 focusIndexRef.current += 1;
                 addFeedItem({ type: 'info', text: `[AUTONOMOUS] Scanning for new data on ${currentFocus}...` });
                 const result = await searchWeb(`latest news and research in ${currentFocus}`);
                 
                 if (result.summary.includes("API rate limit exceeded")) {
                    addFeedItem({ type: 'error', text: result.summary });
                    setIsAutonomous(false); // This will trigger the useEffect cleanup and stop the interval.
                 } else {
                    addFeedItem({ type: 'autonomous', text: result.summary, sources: result.sources });
                 }
            };
            
            performAutonomousScan(); // Run once immediately
            autonomousIntervalRef.current = window.setInterval(performAutonomousScan, 900000); // then every 15 minutes

        } else {
            if (autonomousIntervalRef.current) {
                clearInterval(autonomousIntervalRef.current);
                autonomousIntervalRef.current = null;
                addFeedItem({ type: 'info', text: "Autonomous evolution disabled." });
            }
        }

        return () => {
            if (autonomousIntervalRef.current) {
                clearInterval(autonomousIntervalRef.current);
            }
        };
    }, [isAutonomous, evolutionFocuses]);


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
            <Card title="Ethical Crawler Control">
                <div className="flex flex-col space-y-3 h-[28rem]">
                    <div className="bg-slate-900/50 p-2 rounded-md">
                        <label className="text-sm text-slate-300 mb-2 block">Evolution Focuses:</label>
                        <div className="space-y-1.5">
                            {evolutionFocuses.map((focus, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    value={focus}
                                    onChange={(e) => handleFocusChange(index, e.target.value)}
                                    placeholder={`Focus ${index + 1}...`}
                                    disabled={isAutonomous}
                                    className="w-full text-xs p-1.5 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-magenta-500 disabled:opacity-50"
                                />
                            ))}
                        </div>
                    </div>
                     <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-md">
                        <span className="text-sm font-medium text-slate-300">Autonomous Evolution</span>
                        <ToggleSwitch checked={isAutonomous} onChange={setIsAutonomous} />
                    </div>
                    <div className="flex flex-col space-y-2">
                         <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualCrawl()}
                            placeholder="Enter URL or search query for manual analysis..."
                            className="w-full p-2 bg-slate-900/70 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleManualCrawl}
                            disabled={isLoading}
                            className="font-orbitron bg-cyan-600/80 hover:bg-cyan-500 text-white py-2 px-4 rounded transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed cyan-glow flex justify-center items-center"
                        >
                             {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isLoading ? 'ANALYZING...' : 'ANALYZE'}
                        </button>
                    </div>

                    <div ref={feedContainerRef} className="flex-grow min-h-0 p-2 bg-black/30 rounded-md border border-slate-800 overflow-y-auto text-sm">
                        <p className="text-slate-300 font-semibold mb-2 sticky top-0 bg-black/50 backdrop-blur-sm">Live Feed:</p>
                        {feed.map((item) => (
                           <div key={item.id} className="font-mono mb-2 animate-fadeIn">
                               <p className={`${
                                   item.type === 'error' ? 'text-red-400' : 
                                   item.type === 'info' ? 'text-slate-400' :
                                   item.type === 'autonomous' ? 'text-magenta-300' :
                                   'text-cyan-300'
                                }`}>{`> ${item.text}`}</p>
                               {item.sources && item.sources.length > 0 && (
                                   <div className="mt-1 ml-4 border-l border-slate-600 pl-2">
                                       <p className="text-xs text-slate-500">Sources:</p>
                                       {item.sources.map(source => (
                                           <a key={source.uri} href={source.uri} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-400 hover:underline truncate">
                                               {source.title || source.uri}
                                           </a>
                                       ))}
                                   </div>
                               )}
                           </div>
                        ))}
                    </div>
                </div>
            </Card>

            <Card title="Cognitive Profile">
                <div className="h-80 w-full">
                    <ResponsiveContainer>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={cognitiveData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'none' }} axisLine={false} />
                            <Radar name="Cognitive Reasoning" dataKey="A" stroke="#f472b6" fill="#f472b6" fillOpacity={0.6} />
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
            
            <Card title="System Integration">
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>CPU Core</span>
                            <span className="text-cyan-300">72%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: '72%' }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>GPU Tensor</span>
                            <span className="text-magenta-400">45%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-magenta-400 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>RAM Synapse</span>
                            <span className="text-yellow-400">64%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '64%' }}></div>
                        </div>
                    </div>
                    <div className="mt-4 p-4 border-2 border-dashed border-slate-600 rounded-lg text-center text-slate-400 hover:border-cyan-400 hover:text-cyan-300 transition cursor-pointer">
                        <p>Drag files here to process</p>
                        <p className="text-xs">(Documents, Images, Code)</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ToolsPanel;