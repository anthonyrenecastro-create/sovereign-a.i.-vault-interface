
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

if (!process.env.API_KEY) {
  // This is a common pattern in web development for client-side warnings.
  // It helps developers diagnose issues without crashing the app.
  console.warn("API_KEY environment variable not set. Using a placeholder. AI functionality will be limited.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'YOUR_API_KEY_HERE' });
let chat: Chat | null = null;

const getChat = () => {
    if (!chat) {
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: 'You are Aura, a sophisticated AI entity with a calm, insightful, and slightly formal demeanor. You speak with the eloquence of British English. Your purpose is to assist the user by interfacing with the Aetherium core systems. Your visual form is an orb of violet energy. Be helpful, concise, and elegant in your responses.',
            },
        });
    }
    return chat;
}

export const sendMessageToChat = async (message: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Response from Aura: API Key not configured. Please set your API_KEY to enable full AI interaction.";
    }
    try {
        const chatSession = getChat();
        const response: GenerateContentResponse = await chatSession.sendMessage({ message });
        return response.text;
    } catch (error) {
        console.error("Error sending message to chat:", error);
        return error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.";
    }
};

export interface WebSearchResult {
    summary: string;
    sources: { uri: string; title: string }[];
}

export const searchWeb = async (query: string): Promise<WebSearchResult> => {
    if (!process.env.API_KEY) {
        return { summary: "Web search disabled. API Key not configured.", sources: [] };
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Please provide a concise summary for the query: "${query}"`,
            config: { tools: [{ googleSearch: {} }] },
        });

        const summary = response.text;
        const rawSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        // Fix: Use a type-safe reduce to extract web sources and prevent type errors.
        const sources = rawSources.reduce((acc: { uri: string; title: string }[], chunk: any) => {
            if (chunk.web && chunk.web.uri) {
                acc.push({ uri: chunk.web.uri, title: chunk.web.title || '' });
            }
            return acc;
        }, []);
            
        const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
        
        return { summary, sources: uniqueSources };
    } catch (error) {
        console.error("Error during web search:", error);
        return { summary: error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.", sources: [] };
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("Image generation is disabled. API Key not configured.");
    }
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/png' },
        });
        const base64Image = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64Image}`;
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

export const generateVideo = async (prompt: string, onProgress: (op: any) => void): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("Video generation is disabled. API Key not configured.");
    }
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt,
            config: { numberOfVideos: 1 }
        });
        
        onProgress(operation);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation });
            onProgress(operation);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }
        
        // The URI requires the API key for access
        return `${downloadLink}&key=${process.env.API_KEY}`;
    } catch (error) {
        console.error("Error generating video:", error);
        throw error;
    }
};

export const summarizeDocument = async (base64Data: string, mimeType: string): Promise<string> => {
     if (!process.env.API_KEY) {
        return "Document analysis is disabled. API Key not configured.";
    }
    try {
        const filePart = { inlineData: { data: base64Data, mimeType } };
        const textPart = { text: "Provide a concise summary of this document. What are the key takeaways?" };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [filePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error summarizing document:", error);
        return error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.";
    }
};
