import { GoogleGenAI, Schema, Type, Modality } from "@google/genai";
import { DictionaryEntry, ExampleSentence, SupportedLanguage } from "../types";

const apiKey = process.env.API_KEY;

// Helper to create a new client instance
const getAiClient = () => {
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Dictionary Lookup ---

const entrySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    targetTerm: {
      type: Type.STRING,
      description: "The word or phrase translated into the Target Language.",
    },
    nativeTerm: {
      type: Type.STRING,
      description: "The word or phrase translated into the Native Language.",
    },
    definition: {
      type: Type.STRING,
      description: "A natural language explanation in the user's native language.",
    },
    examples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          target: { type: Type.STRING, description: "Sentence in target language" },
          native: { type: Type.STRING, description: "Translation in native language" }
        }
      }
    },
    usageGuide: {
      type: Type.STRING,
      description: "A fun, casual, friend-like explanation (not textbook style). Mention cultural context, tone, or slang. Keep it brief and witty.",
    }
  },
  required: ["targetTerm", "nativeTerm", "definition", "examples", "usageGuide"]
};

export const lookupTerm = async (
  term: string,
  nativeLang: SupportedLanguage,
  targetLang: SupportedLanguage
): Promise<Omit<DictionaryEntry, 'id' | 'timestamp' | 'imageUrl' | 'term'>> => {
  const ai = getAiClient();
  
  const prompt = `
    User speaks: ${nativeLang}
    Learning: ${targetLang}
    Input: "${term}"
    
    Task:
    1. Identify the input word/phrase.
    2. Provide the 'targetTerm' (How you say this concept in ${targetLang}).
    3. Provide the 'nativeTerm' (How you say this concept in ${nativeLang}).
    4. Explain the concept in natural ${nativeLang} (definition).
    5. Provide 2 example sentences in ${targetLang} with ${nativeLang} translations.
    6. Write a 'Usage Guide': A fun, casual, friend-like explanation (not textbook style). Mention cultural context, tone, or slang. Keep it short and punchy.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: entrySchema
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  return JSON.parse(text);
};

// --- Translation (Diary) ---

export const translateText = async (
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage
): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
    Translate the following text strictly from ${fromLang} to ${toLang}.
    Return ONLY the translated text. Do not add explanations or notes.
    
    Text: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text?.trim() || "Translation failed.";
  } catch (e) {
    console.error("Translation failed", e);
    throw e;
  }
};

// --- Image Generation ---

const ART_STYLES = [
  "Minimalist, vibrant, flat vector art illustration",
  "Soft, warm, watercolor style illustration",
  "Playful, bold, cartoon-style illustration",
  "Modern, clean, isometric 3D icon style",
  "Pop-art inspired, colorful illustration"
];

export const generateConceptImage = async (term: string, targetLang: string): Promise<string | undefined> => {
  const ai = getAiClient();
  
  // Pick a random style for variety
  const randomStyle = ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)];

  const prompt = `${randomStyle} representing the concept of "${term}" (language: ${targetLang}). Bright colors, clean composition, suitable for a mobile app flashcard.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
    });

    // Extract image from parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return undefined;
  } catch (e) {
    console.error("Image generation failed", e);
    // Fallback to placeholder if generation fails (graceful degradation)
    return `https://picsum.photos/400/400?blur=2`; 
  }
};

// --- Story Generation ---

export const generateStoryFromWords = async (
  words: string[],
  nativeLang: SupportedLanguage,
  targetLang: SupportedLanguage
): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
    Create a short, funny story (max 150 words) in ${targetLang} that incorporates the following words: 
    ${words.join(', ')}.
    
    After the story, provide a translation in ${nativeLang}.
    
    Please use this exact format:
    [Story in ${targetLang}]
    
    ---
    
    [Translation in ${nativeLang}]
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "Could not generate story. Please try again.";
  } catch (e) {
    console.error("Story generation failed", e);
    throw e;
  }
};

// --- Chat ---

export const sendChatMessage = async (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  contextTerm: string,
  targetLang: string
): Promise<string> => {
  const ai = getAiClient();
  
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: `You are a helpful language tutor assisting with the word/phrase "${contextTerm}" in ${targetLang}. Keep answers concise and helpful.`
    }
  });

  const result = await chat.sendMessage({ message: newMessage });
  return result.text || "";
};

// --- Text to Speech (TTS) ---

// Singleton AudioContext to avoid browser limits
let audioCtx: AudioContext | null = null;
// Use Promise cache to handle race conditions (play while fetching)
const ttsCache = new Map<string, Promise<AudioBuffer | null>>();

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

// Ensure AudioContext is running (call this on user interaction)
export const resumeAudioContext = async () => {
    const ctx = getAudioContext();
    // Always attempt to resume if suspended, important for mobile browsers
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.error("Failed to resume audio context", e);
        }
    }
};

// Helper to decode Base64 string to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fetch and decode logic, wrapped in a function that returns a Promise
async function fetchAndDecodeTTS(text: string, lang: string): Promise<AudioBuffer | null> {
  // Guard against empty text
  if (!text || !text.trim()) return null;

  const ai = getAiClient();
  const ctx = getAudioContext();
  const voiceName = 'Kore'; // 'Kore' is typically balanced and stable

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
      throw new Error("No audio data received from Gemini");
  }

  let byteArray = decodeBase64(base64Audio);
  
  // Safety check: ensure even byte length for 16-bit PCM
  if (byteArray.length % 2 !== 0) {
      // console.warn("Odd byte length received for PCM 16-bit, trimming last byte.");
      byteArray = byteArray.slice(0, byteArray.length - 1);
  }
  
  // Gemini TTS returns 24kHz raw PCM mono audio. 
  const audioBuffer = ctx.createBuffer(1, byteArray.length / 2, 24000);
  const channelData = audioBuffer.getChannelData(0);
  
  // Create view on the buffer. 
  const dataInt16 = new Int16Array(byteArray.buffer, byteArray.byteOffset, byteArray.length / 2);
  
  // Convert Int16 PCM to Float32 [-1.0, 1.0]
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return audioBuffer;
}

// Get buffer from cache or fetch new
async function getTTSBuffer(text: string, lang: string): Promise<AudioBuffer | null> {
    const cacheKey = `${lang}:${text}`;
    
    if (ttsCache.has(cacheKey)) {
        return ttsCache.get(cacheKey)!;
    }

    // Store the promise immediately to prevent duplicate requests
    const promise = fetchAndDecodeTTS(text, lang).catch(err => {
        console.error("TTS Fetch failed:", err);
        ttsCache.delete(cacheKey); // Evict from cache if failed so user can retry
        return null;
    });

    ttsCache.set(cacheKey, promise);
    return promise;
}

// Helper to play a buffer and wait for it to finish
function playBuffer(ctx: AudioContext, buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start(0);
  });
}

// Main Play Function
export const playTTS = async (text: string, lang: string): Promise<void> => {
  if (!text) return;
  
  await resumeAudioContext();
  const ctx = getAudioContext();

  let buffer = await getTTSBuffer(text, lang);
  
  // If buffer is null (e.g., failed prefetch), try ONE retry immediately
  if (!buffer) {
      const cacheKey = `${lang}:${text}`;
      // Ensure cache is clear for this key
      ttsCache.delete(cacheKey);
      // Fetch fresh
      buffer = await getTTSBuffer(text, lang);
  }
  
  if (buffer) {
    await playBuffer(ctx, buffer);
  } else {
      console.warn("Buffer still null after retry, could not play audio.");
  }
};

// Prefetch Function (Fire and forget)
export const prefetchTTS = (text: string, lang: string) => {
    if (!text) return;
    getTTSBuffer(text, lang).catch(() => {}); 
};