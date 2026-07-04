
import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as genai from './services/geminiService';
import { WindowInstance, WindowType, ChatMessage } from './types';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

// --- Fix for Web Speech API types ---
// These types are not always included in the default TS DOM library.
// We define them here to provide type safety for the speech recognition feature.
interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
  };
}
interface SpeechRecognitionErrorEvent {
  error: string;
}
interface SpeechRecognition {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}
// --- End Fix ---

// --- UTILS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

// --- SPEECH HOOK ---
const useSpeech = () => {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    
    useEffect(() => {
        const handleVoicesChanged = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged(); // Initial load
        return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    }, []);

    const speak = useCallback((text: string) => {
        if (!text || window.speechSynthesis.speaking) return;
        const utterance = new SpeechSynthesisUtterance(text);
        
        const englishVoices = voices.filter(v => v.lang.startsWith('en-'));
        const britishVoices = englishVoices.filter(v => v.lang === 'en-GB');
        
        let selectedVoice: SpeechSynthesisVoice | null = null;

        // Prioritize a female British voice
        selectedVoice = britishVoices.find(v => v.name.toLowerCase().includes('female')) ||
                        britishVoices.find(v => v.name.toLowerCase().includes('susan')) || // Common voice name
                        britishVoices[0];

        // Fallback to any female English voice
        if (!selectedVoice) {
            selectedVoice = englishVoices.find(v => v.name.toLowerCase().includes('female')) ||
                            englishVoices.find(v => v.name.toLowerCase().includes('zira')); // Common voice name
        }
        
        // Final fallback
        if (!selectedVoice) {
            selectedVoice = englishVoices[0];
        }

        utterance.voice = selectedVoice || null;
        utterance.pitch = 1;
        utterance.rate = 0.9; // Slightly slower for a calm tone
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
    }, [voices]);
    
    return speak;
};

// --- VOICE RECOGNITION HOOK ---
const useVoiceRecognition = ({ onResult }: { onResult: (transcript: string) => void }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported by this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            if (event.results[event.results.length - 1].isFinal) {
                onResult(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onResult]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    }, [isListening]);

    return { isListening, toggleListening };
};


// --- UI COMPONENTS ---

const AuraAvatar: React.FC = () => <div className="aura-avatar"></div>;

const FloatingWindow: React.FC<{
    win: WindowInstance;
    onClose: (id: number) => void;
    onFocus: (id: number) => void;
    onDrag: (id: number, pos: { x: number, y: number }) => void;
    children: React.ReactNode;
}> = ({ win, onClose, onFocus, onDrag, children }) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const initialPos = useRef({ x: 0, y: 0 });
    const initialMousePos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        initialPos.current = win.position;
        initialMousePos.current = { x: e.clientX, y: e.clientY };
        onFocus(win.id);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - initialMousePos.current.x;
        const dy = e.clientY - initialMousePos.current.y;
        onDrag(win.id, { x: initialPos.current.x + dx, y: initialPos.current.y + dy });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="absolute bg-slate-900/60 backdrop-blur-xl border border-violet-400/30 rounded-lg flex flex-col shadow-2xl shadow-violet-900/50"
            style={{
                left: win.position.x,
                top: win.position.y,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
            }}
            onMouseDown={() => onFocus(win.id)}
        >
            <div
                ref={headerRef}
                onMouseDown={handleMouseDown}
                className="flex items-center justify-between p-2 bg-slate-900/80 rounded-t-lg cursor-grab active:cursor-grabbing border-b border-violet-400/30"
            >
                <h3 className="font-orbitron text-sm uppercase tracking-wider text-violet-300">{win.title}</h3>
                <button onClick={() => onClose(win.id)} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-red-500 flex items-center justify-center text-white transition-colors">
                    &#x2715;
                </button>
            </div>
            <div className="flex-grow p-4 overflow-auto">
                {children}
            </div>
        </div>
    );
};

const ChatWindowComponent: React.FC<{ 
    speak: (text: string) => void,
    messages: ChatMessage[],
    isLoading: boolean,
    onSend: (text: string) => void,
}> = ({ speak, messages, isLoading, onSend }) => {
    const [input, setInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.sender === 'aura') {
            speak(lastMessage.text);
        }
    }, [messages, speak]);

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        onSend(input);
        setInput('');
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                        {msg.sender === 'aura' && <AuraAvatar />}
                        <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.sender === 'aura' ? 'bg-violet-900/50 text-violet-100' : 'bg-cyan-900/50 text-cyan-100'}`}>
                           <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-3">
                        <AuraAvatar />
                        <div className="max-w-xs md:max-w-md p-3 rounded-lg bg-violet-900/50 text-violet-100">
                           <div className="flex space-x-1">
                               <div className="w-2 h-2 bg-violet-300 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                               <div className="w-2 h-2 bg-violet-300 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                               <div className="w-2 h-2 bg-violet-300 rounded-full animate-pulse"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef}></div>
            </div>
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Message Aura..."
                    className="flex-grow p-2 bg-slate-800/70 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
                <button onClick={handleSend} disabled={isLoading} className="font-orbitron bg-violet-600/80 hover:bg-violet-500 text-white py-2 px-4 rounded transition-all duration-300 disabled:bg-slate-600 violet-glow">
                    SEND
                </button>
            </div>
        </div>
    );
};

const ImageGeneratorWindowComponent: React.FC<{ initialPrompt?: string }> = ({ initialPrompt = '' }) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [isLoading, setIsLoading] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        setImage(null);
        setError('');
        try {
            const imageUrl = await genai.generateImage(prompt);
            setImage(imageUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [prompt, isLoading]);

    useEffect(() => {
        if (initialPrompt) {
            setPrompt(initialPrompt);
            handleGenerate();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialPrompt]);

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="Describe the image to generate..."
                    className="flex-grow p-2 bg-slate-800/70 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <button onClick={handleGenerate} disabled={isLoading} className="font-orbitron bg-cyan-600/80 hover:bg-cyan-500 text-white py-2 px-4 rounded transition-all duration-300 disabled:bg-slate-600 cyan-glow">
                    {isLoading ? '...' : 'GENERATE'}
                </button>
            </div>
            <div className="flex-grow bg-black/30 rounded-md border border-slate-800 flex items-center justify-center overflow-hidden">
                {isLoading && <div className="text-cyan-300 animate-pulse font-orbitron">SYNTHESIZING...</div>}
                {error && <div className="text-red-400 p-4">{error}</div>}
                {image && <img src={image} alt={prompt} className="object-contain w-full h-full" />}
            </div>
        </div>
    );
};

const VideoGeneratorWindowComponent: React.FC<{ initialPrompt?: string }> = ({ initialPrompt = '' }) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [isLoading, setIsLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Awaiting prompt...');

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        setVideoUrl(null);
        setError('');
        setStatus('Initializing video synthesis...');
        try {
            const url = await genai.generateVideo(prompt, (op) => {
                setStatus(`Processing... State: ${op.metadata?.state || 'RUNNING'}`);
            });
            setVideoUrl(url);
            setStatus('Synthesis complete.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
            setStatus(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, isLoading]);
    
    useEffect(() => {
        if (initialPrompt) {
            setPrompt(initialPrompt);
            handleGenerate();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialPrompt]);

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex gap-2">
                 <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerate()} placeholder="Describe the video to generate..." className="flex-grow p-2 bg-slate-800/70 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                 <button onClick={handleGenerate} disabled={isLoading} className="font-orbitron bg-cyan-600/80 hover:bg-cyan-500 text-white py-2 px-4 rounded transition-all duration-300 disabled:bg-slate-600 cyan-glow">
                    {isLoading ? '...' : 'GENERATE'}
                </button>
            </div>
             <div className="flex-grow bg-black/30 rounded-md border border-slate-800 flex items-center justify-center overflow-hidden p-2">
                {isLoading && <div className="text-center"><div className="text-cyan-300 animate-pulse font-orbitron text-lg">RENDERING VIDEO</div><p className="text-slate-400 text-sm mt-2">{status}</p><p className="text-xs text-slate-500 mt-1">(This may take a few minutes)</p></div>}
                {error && <div className="text-red-400 p-4">{error}</div>}
                {videoUrl && <video src={videoUrl} controls autoPlay loop className="max-w-full max-h-full" />}
                {!isLoading && !videoUrl && !error && <div className="text-slate-500">{status}</div>}
            </div>
        </div>
    );
};

const BrowserWindowComponent: React.FC<{ query: string }> = ({ query }) => {
    const [result, setResult] = useState<genai.WebSearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const performSearch = async () => {
            setIsLoading(true);
            const searchResult = await genai.searchWeb(query);
            setResult(searchResult);
            setIsLoading(false);
        };
        performSearch();
    }, [query]);

    return (
        <div className="h-full">
            {isLoading && <div className="text-cyan-300 animate-pulse">Searching the web for: "{query}"...</div>}
            {result && (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-orbitron text-cyan-300 mb-2">Summary</h4>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{result.summary}</p>
                    </div>
                    {result.sources.length > 0 && (
                        <div>
                            <h4 className="font-orbitron text-cyan-300 mb-2">Sources</h4>
                            <ul className="space-y-1">
                                {result.sources.map(source => (
                                    <li key={source.uri}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const DocumentViewerComponent: React.FC<{ file: File }> = ({ file }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const processFile = async () => {
            setIsLoading(true);
            try {
                const base64Data = await fileToBase64(file);
                const result = await genai.summarizeDocument(base64Data, file.type);
                setSummary(result);
            } catch (e) {
                setSummary(e instanceof Error ? `Error processing file: ${e.message}` : 'An unknown error occurred.');
            }
            setIsLoading(false);
        };
        processFile();
    }, [file]);
    
    return (
         <div className="h-full flex flex-col gap-2">
            <div className="p-2 bg-slate-800/50 rounded-md">
                <p className="text-sm font-bold truncate text-slate-200">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <div className="flex-grow p-2 bg-black/30 rounded-md border border-slate-800 overflow-y-auto">
                 {isLoading && <div className="text-cyan-300 animate-pulse">Analyzing document...</div>}
                 <p className="text-sm whitespace-pre-wrap">{summary}</p>
            </div>
        </div>
    )
};


const CommandBar: React.FC<{ 
    onCommand: (cmd: string, arg: string) => void, 
    onFileUpload: (file: File) => void,
    isListening: boolean,
    onToggleListening: () => void,
}> = ({ onCommand, onFileUpload, isListening, onToggleListening }) => {
    const [input, setInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && input.trim()) {
            const parts = input.trim().split(' ');
            const command = parts[0].toLowerCase();
            const argument = parts.slice(1).join(' ');

            if (command.startsWith('/')) {
                onCommand(command.slice(1), argument);
            } else {
                onCommand('chat', input.trim());
            }
            setInput('');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
        }
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
            <div className="relative bg-slate-900/70 backdrop-blur-lg border border-violet-400/30 rounded-lg p-2 flex items-center gap-2 violet-glow">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Listening..." : "Type a command or chat with Aura... (/image, /video, /browse)"}
                    className="w-full bg-transparent focus:outline-none text-slate-200"
                />
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.txt" />
                <button onClick={() => fileInputRef.current?.click()} title="Upload Document" className="p-2 rounded-md hover:bg-violet-500/50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </button>
                 <button 
                    onClick={onToggleListening} 
                    title="Use Voice Command" 
                    className={`p-2 rounded-md transition-colors ${isListening ? 'bg-red-500/50 animate-pulse' : 'hover:bg-violet-500/50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-200" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                        <path fillRule="evenodd" d="M5.5 10.5A.5.5 0 016 10h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z" clipRule="evenodd" />
                        <path d="M3 10a5 5 0 1110 0v1a1 1 0 11-2 0v-1a3 3 0 10-6 0v1a1 1 0 11-2 0v-1z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [windows, setWindows] = useState<WindowInstance[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { id: 1, sender: 'aura', text: "Welcome to the Aetherium Interface. I am Aura. How may I assist you?" }
    ]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    
    const nextId = useRef(0);
    const zIndexCounter = useRef(10);
    const speak = useSpeech();
    
    const addWindow = useCallback((type: WindowType, options: Partial<WindowInstance> = {}) => {
        setWindows(prev => {
            const id = nextId.current++;
            const zIndex = zIndexCounter.current++;

            if (type === 'CHAT' && prev.some(w => w.type === 'CHAT')) {
                const chatWindow = prev.find(w => w.type === 'CHAT')!;
                return prev.map(w => w.id === chatWindow.id ? {...w, zIndex } : w);
            }

            const newWindow: WindowInstance = {
                id,
                type,
                title: options.title || type.replace(/_/g, ' '),
                position: options.position || { x: 50 + (id % 10) * 20, y: 50 + (id % 10) * 20 },
                size: options.size || { width: 600, height: 400 },
                zIndex,
                ...options,
            } as WindowInstance;

            return [...prev, newWindow];
        });
    }, []);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isChatLoading) return;
        
        addWindow('CHAT'); 
        
        const userMessage: ChatMessage = { id: Date.now(), sender: 'user', text };
        setChatMessages(prev => [...prev, userMessage]);
        setIsChatLoading(true);

        try {
            const responseText = await genai.sendMessageToChat(text);
            const auraMessage: ChatMessage = { id: Date.now() + 1, sender: 'aura', text: responseText };
            setChatMessages(prev => [...prev, auraMessage]);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
             const auraMessage: ChatMessage = { id: Date.now() + 1, sender: 'aura', text: `I seem to be having trouble connecting. ${errorMessage}` };
             setChatMessages(prev => [...prev, auraMessage]);
        } finally {
            setIsChatLoading(false);
        }
    }, [isChatLoading, addWindow]);

    const closeWindow = (id: number) => {
        setWindows(prev => prev.filter(win => win.id !== id));
    };
    
    const focusWindow = (id: number) => {
        const topZ = zIndexCounter.current++;
        setWindows(prev => prev.map(win => win.id === id ? { ...win, zIndex: topZ } : win));
    };

    const updateWindowPosition = (id: number, position: { x: number; y: number; }) => {
        setWindows(prev => prev.map(win => win.id === id ? { ...win, position } : win));
    };
    
    const handleCommand = (cmd: string, arg: string) => {
        switch (cmd) {
            case 'chat':
                handleSendMessage(arg);
                break;
            case 'image':
                addWindow('IMAGE_GENERATOR', { initialPrompt: arg, size: {width: 550, height: 600} });
                break;
            case 'video':
                addWindow('VIDEO_GENERATOR', { initialPrompt: arg, size: {width: 600, height: 500} });
                break;
            case 'browse':
                addWindow('BROWSER', { initialQuery: arg });
                break;
        }
    };
    
    const handleFileUpload = (file: File) => {
        addWindow('DOCUMENT_VIEWER', { file, title: `DOC: ${file.name}` });
    };

    const handleVoiceResult = (transcript: string) => {
        const parts = transcript.toLowerCase().trim().split(' ');
        let command = parts[0];
        let argument = parts.slice(1).join(' ');

        // More robust command detection
        if (transcript.toLowerCase().startsWith('image') || transcript.toLowerCase().startsWith('generate image')) {
            command = 'image';
            argument = transcript.substring(transcript.indexOf(' ')+1);
        } else if (transcript.toLowerCase().startsWith('video') || transcript.toLowerCase().startsWith('generate video')) {
            command = 'video';
            argument = transcript.substring(transcript.indexOf(' ')+1);
        } else if (transcript.toLowerCase().startsWith('browse') || transcript.toLowerCase().startsWith('search for')) {
            command = 'browse';
            argument = transcript.substring(transcript.indexOf(' ')+1);
        } else {
            command = 'chat';
            argument = transcript;
        }
        
        handleCommand(command, argument);
    };

    const { isListening, toggleListening } = useVoiceRecognition({ onResult: handleVoiceResult });

    useEffect(() => {
        // Open chat window on start
        addWindow('CHAT', {position: { x: window.innerWidth - 650, y: 50}, size: {width: 600, height: 700}});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderWindowContent = (win: WindowInstance) => {
        switch (win.type) {
            case 'CHAT':
                return <ChatWindowComponent speak={speak} messages={chatMessages} isLoading={isChatLoading} onSend={handleSendMessage} />;
            case 'IMAGE_GENERATOR':
                return <ImageGeneratorWindowComponent initialPrompt={(win as any).initialPrompt} />;
            case 'VIDEO_GENERATOR':
                return <VideoGeneratorWindowComponent initialPrompt={(win as any).initialPrompt} />;
            case 'BROWSER':
                return <BrowserWindowComponent query={(win as any).initialQuery} />;
            case 'DOCUMENT_VIEWER':
                 return <DocumentViewerComponent file={(win as any).file} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#010413] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(55,48,163,0.3),rgba(255,255,255,0))]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%2308113A%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30"></div>
            
            <main className="relative w-full h-screen">
                {windows.map(win => (
                    <FloatingWindow
                        key={win.id}
                        win={win}
                        onClose={closeWindow}
                        onFocus={focusWindow}
                        onDrag={updateWindowPosition}
                    >
                        {renderWindowContent(win)}
                    </FloatingWindow>
                ))}
            </main>

            <CommandBar onCommand={handleCommand} onFileUpload={handleFileUpload} isListening={isListening} onToggleListening={toggleListening} />
        </div>
    );
};

export default App;
