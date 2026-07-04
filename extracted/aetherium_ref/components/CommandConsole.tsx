
import React, { useState } from 'react';
import Card from './Card';
import { INITIAL_TASKS } from '../constants';
import { Task } from '../types';
// Fix: Import sendMessageToChat instead of non-existent generateText.
import { sendMessageToChat } from '../services/geminiService';

const TaskItem: React.FC<{ task: Task }> = ({ task }) => {
    const statusColor = {
        Running: 'text-cyan-400 animate-pulse',
        Queued: 'text-slate-400',
        Complete: 'text-green-400',
        Error: 'text-red-400',
    };
    return (
        <div className="flex justify-between items-center text-sm py-1.5 border-b border-slate-700/50 last:border-b-0">
            <span className="text-slate-300">{task.name}</span>
            <span className={statusColor[task.status]}>{task.status}</span>
        </div>
    );
};

const CommandConsole: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [output, setOutput] = useState('Awaiting command...');
    const [isLoading, setIsLoading] = useState(false);
    const [tasks] = useState<Task[]>(INITIAL_TASKS);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setOutput('Processing command through the symbolic interpreter...');
        
        try {
            // Fix: Call sendMessageToChat instead of the non-existent generateText.
            const result = await sendMessageToChat(prompt);
            setOutput(result);
        } catch (error) {
            setOutput('A critical error occurred in the cognitive core.');
            console.error(error);
        } finally {
            setIsLoading(false);
            setPrompt('');
        }
    };

    return (
        <div className="grid grid-cols-3 gap-4 animate-fadeIn">
            <div className="col-span-2 flex flex-col gap-4">
                <Card title="Main Prompt Interface" className="flex-grow flex flex-col">
                    <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Type commands, ask questions, or provide text for the AI..."
                            className="w-full h-32 p-3 bg-slate-900/70 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition text-slate-200 resize-none"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-3 w-full font-orbitron bg-cyan-600/80 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed cyan-glow flex items-center justify-center"
                        >
                             {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>}
                            {isLoading ? 'TRANSMITTING...' : 'EXECUTE'}
                        </button>
                    </form>
                </Card>
                <Card title="Output Canvas" className="flex-grow">
                     <div className="h-64 p-3 bg-slate-900/70 border border-slate-700 rounded-md overflow-y-auto text-slate-300 whitespace-pre-wrap">
                        {output}
                    </div>
                </Card>
            </div>
            <div className="col-span-1">
                <Card title="Task Manager">
                    <div className="space-y-1">
                        {tasks.map(task => <TaskItem key={task.id} task={task} />)}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CommandConsole;
