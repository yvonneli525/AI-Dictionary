import React, { useState, useEffect } from 'react';
import { DictionaryEntry, ChatMessage, SupportedLanguage } from '../types';
import { Volume2, MessageCircle, Save, Check, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { playTTS, sendChatMessage, prefetchTTS, generateConceptImage } from '../services/geminiService';

interface Props {
  entry: DictionaryEntry;
  targetLang: SupportedLanguage;
  onSave: (entry: DictionaryEntry) => void;
  isSaved: boolean;
}

export const ResultCard: React.FC<Props> = ({ entry, targetLang, onSave, isSaved }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  
  // Local state for image management (allows regeneration)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(entry.imageUrl);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Sync with prop if entry changes completely (new search)
  useEffect(() => {
    setCurrentImageUrl(entry.imageUrl);
  }, [entry.id, entry.imageUrl]);

  // Prefetch audio for main term and examples when card loads
  // We stagger them slightly to avoid hitting API rate limits instantly
  useEffect(() => {
    if (entry) {
        // Immediate prefetch for the main term (highest priority)
        prefetchTTS(entry.targetTerm, targetLang);
        
        // Delay examples slightly
        const timer = setTimeout(() => {
             entry.examples.forEach(ex => prefetchTTS(ex.target, targetLang));
        }, 800);

        return () => clearTimeout(timer);
    }
  }, [entry, targetLang]);

  const handleTTS = async (text: string, id: string) => {
    setIsPlayingAudio(id);
    try {
        await playTTS(text, targetLang);
    } catch (e) {
        console.error("Playback failed", e);
    } finally {
        setIsPlayingAudio(null);
    }
  };

  const handleRegenerateImage = async () => {
    if (isImageLoading) return;
    setIsImageLoading(true);
    try {
        // Generate a new image for the same term
        const newUrl = await generateConceptImage(entry.term, targetLang);
        if (newUrl) {
            setCurrentImageUrl(newUrl);
        }
    } catch (e) {
        console.error("Failed to regenerate image", e);
    } finally {
        setIsImageLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = { role: 'user', text: inputMessage };
    setChatHistory((prev) => [...prev, newMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      // Transform chat history for Gemini API
      const apiHistory = chatHistory.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await sendChatMessage(apiHistory, newMsg.text, entry.targetTerm, targetLang);
      setChatHistory((prev) => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [...prev, { role: 'model', text: "Sorry, I couldn't connect right now." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSave = () => {
      // Save with the currently displayed image, not necessarily the original one
      onSave({ ...entry, imageUrl: currentImageUrl });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24 animate-fade-in-up">
      {/* Header Image & Title */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-indigo-50 group">
        <div className="h-48 w-full bg-gray-100 relative overflow-hidden">
            {currentImageUrl ? (
                <img 
                    src={currentImageUrl} 
                    alt={entry.term} 
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`} 
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-300">
                    <span className="text-sm">No Image Available</span>
                </div>
            )}
            
            {/* Loading Overlay */}
            {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-white/80 p-3 rounded-full shadow-lg">
                        <RefreshCw size={24} className="text-indigo-600 animate-spin" />
                    </div>
                </div>
            )}

            {/* Controls Overlay */}
           <div className="absolute top-4 right-4 flex gap-2">
                <button
                    onClick={handleRegenerateImage}
                    disabled={isImageLoading}
                    className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
                    title="Generate new image"
                >
                    <RefreshCw size={20} className={isImageLoading ? 'animate-spin' : ''} />
                </button>
           </div>

           <div className="absolute -bottom-6 right-6 z-20">
              <button
                onClick={handleSave}
                className={`p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center ${
                    isSaved ? 'bg-green-500 text-white' : 'bg-white text-indigo-600'
                }`}
              >
                {isSaved ? <Check size={24} /> : <Save size={24} />}
              </button>
           </div>
        </div>
        
        <div className="pt-8 px-6 pb-6">
            <div className="flex flex-col gap-2 mb-4">
               {/* Target Language Display (Primary) */}
               <div className="flex flex-wrap items-baseline gap-3">
                    <h1 className="text-4xl font-black text-indigo-900 tracking-tight">{entry.targetTerm}</h1>
                    <button 
                        onClick={() => handleTTS(entry.targetTerm, 'main')}
                        className={`p-2.5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors ${isPlayingAudio === 'main' ? 'animate-pulse ring-2 ring-indigo-400' : ''}`}
                    >
                        <Volume2 size={24} />
                    </button>
                </div>

                {/* Native Language Display (Secondary) */}
                <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-lg font-bold text-gray-500">{entry.nativeTerm}</span>
                </div>
            </div>
            
            <p className="text-lg text-gray-700 font-medium leading-relaxed border-l-4 border-yellow-400 pl-4 bg-yellow-50/50 py-2 rounded-r-lg">
                {entry.definition}
            </p>
        </div>
      </div>

      {/* Usage Guide (The "Chatty" part) */}
      <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <MessageCircle size={100} />
        </div>
        <div className="flex items-center gap-2 mb-3 opacity-90 relative z-10">
            <div className="bg-white/20 p-1.5 rounded-lg">
                <MessageCircle size={18} />
            </div>
            <span className="font-bold uppercase text-xs tracking-wider">Quick Note</span>
        </div>
        <p className="text-lg font-medium leading-relaxed opacity-95 relative z-10">
            {entry.usageGuide}
        </p>
      </div>

      {/* Examples */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800 ml-2 flex items-center gap-2">
            <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
            Examples
        </h3>
        {entry.examples?.map((ex, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
                <button 
                    onClick={() => handleTTS(ex.target, `ex-${idx}`)}
                    className={`mt-1 p-2.5 rounded-full bg-gray-50 text-indigo-500 hover:bg-indigo-100 transition-colors flex-shrink-0 ${isPlayingAudio === `ex-${idx}` ? 'animate-pulse bg-indigo-100' : ''}`}
                >
                    <Volume2 size={20} />
                </button>
                <div>
                    <p className="text-xl font-bold text-indigo-900 mb-1.5 leading-snug">{ex.target}</p>
                    <p className="text-gray-500 font-medium">{ex.native}</p>
                </div>
            </div>
        ))}
      </div>

      {/* Chat Section */}
      <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-indigo-900">Ask more about "{entry.targetTerm}"</h3>
            <button 
                onClick={() => setChatOpen(!chatOpen)}
                className="text-sm text-indigo-600 font-bold hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors"
            >
                {chatOpen ? 'Close Chat' : 'Open Chat'}
            </button>
        </div>
        
        {chatOpen && (
            <div className="bg-white rounded-2xl shadow-inner p-4 h-80 flex flex-col border border-indigo-100">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin">
                    {chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm space-y-2">
                            <MessageCircle size={32} className="opacity-20" />
                            <p>Curious? Ask me anything!</p>
                        </div>
                    )}
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                             <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-none text-xs font-medium italic animate-pulse flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                                Thinking...
                             </div>
                        </div>
                    )}
                </div>
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input 
                        type="text" 
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type your question..."
                        className="flex-1 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                    />
                    <button 
                        type="submit"
                        disabled={isChatLoading}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center"
                    >
                        <ArrowRight size={18} />
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  );
};