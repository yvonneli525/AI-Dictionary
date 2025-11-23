import React, { useState, useEffect } from 'react';
import { AppSettings, DictionaryEntry, SupportedLanguage, ViewState } from './types';
import { LanguageSelector } from './components/LanguageSelector';
import { ResultCard } from './components/ResultCard';
import { Flashcard } from './components/Flashcard';
import { lookupTerm, generateConceptImage, generateStoryFromWords, resumeAudioContext, playTTS, translateText } from './services/geminiService';
import { Search, Book, Sparkles, Home, ArrowLeft, GraduationCap, Volume2, PenTool, Copy, Check } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [settings, setSettings] = useState<AppSettings>({
    nativeLang: SupportedLanguage.ENGLISH,
    targetLang: SupportedLanguage.SPANISH,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<DictionaryEntry | null>(null);
  const [notebook, setNotebook] = useState<DictionaryEntry[]>(() => {
    const saved = localStorage.getItem('linguapop_notebook');
    return saved ? JSON.parse(saved) : [];
  });
  const [story, setStory] = useState<string | null>(null);
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);

  // Diary State
  const [diaryInput, setDiaryInput] = useState('');
  const [diaryResult, setDiaryResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingDiary, setIsPlayingDiary] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDiarySaved, setIsDiarySaved] = useState(false);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('linguapop_notebook', JSON.stringify(notebook));
  }, [notebook]);

  // --- Handlers ---
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;
    
    // Warm up audio context immediately on interaction
    resumeAudioContext();

    setIsLoading(true);
    setView(ViewState.RESULTS);
    setStory(null);

    try {
      // Parallel requests for text data and image
      const [textData, imageUrl] = await Promise.all([
        lookupTerm(searchTerm, settings.nativeLang, settings.targetLang),
        generateConceptImage(searchTerm, settings.targetLang)
      ]);

      const newEntry: DictionaryEntry = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        term: searchTerm,
        ...textData,
        imageUrl: imageUrl // might be undefined, handled in UI
      };

      setCurrentResult(newEntry);
    } catch (error) {
      console.error("Search failed:", error);
      alert("Oops! The AI got a bit confused. Please try again.");
      setView(ViewState.HOME);
    } finally {
      setIsLoading(false);
    }
  };

  const saveEntry = (entry: DictionaryEntry) => {
    if (!notebook.find(n => n.term === entry.term)) {
      setNotebook([entry, ...notebook]);
    }
  };

  const handleGenerateStory = async () => {
    if (notebook.length < 3) {
      alert("Save at least 3 words to your notebook to create a story!");
      return;
    }
    setIsStoryLoading(true);
    try {
      // Prioritize the target language term if available (new data), fallback to search term (legacy data)
      const words = notebook
        .slice(0, 10)
        .map(n => n.targetTerm || n.term); 

      const generatedStory = await generateStoryFromWords(words, settings.nativeLang, settings.targetLang);
      setStory(generatedStory);
    } catch (e) {
        console.error(e);
        alert("Couldn't write a story right now. Please try again later.");
    } finally {
        setIsStoryLoading(false);
    }
  };

  const handlePlayStory = async () => {
    if (!story) return;
    setIsPlayingStory(true);
    try {
      // Split by '---' to try and isolate the target language story from the translation
      // This is a heuristic based on the prompt structure used in geminiService
      const storyText = story.split('---')[0];
      await playTTS(storyText, settings.targetLang);
    } catch (e) {
      console.error("Story playback failed", e);
    } finally {
      setIsPlayingStory(false);
    }
  };

  const handleTranslateDiary = async () => {
    if (!diaryInput.trim()) return;
    setIsTranslating(true);
    setDiaryResult('');
    setIsCopied(false);
    setIsDiarySaved(false);
    resumeAudioContext();
    try {
      const translation = await translateText(diaryInput, settings.nativeLang, settings.targetLang);
      setDiaryResult(translation);
    } catch (e) {
      console.error(e);
      alert("Translation failed. Try again!");
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePlayDiary = async () => {
    if (!diaryResult) return;
    setIsPlayingDiary(true);
    try {
      await playTTS(diaryResult, settings.targetLang);
    } catch (e) {
      console.error("Diary playback failed", e);
    } finally {
      setIsPlayingDiary(false);
    }
  };

  const handleCopyDiary = async () => {
    if (!diaryResult) return;
    await navigator.clipboard.writeText(diaryResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveDiary = () => {
    if (!diaryResult || !diaryInput) return;
    
    // Construct a DictionaryEntry from the diary entry
    // We intentionally flip term/definition for Flashcards:
    // Term (Front) = Target Language Result
    // Definition (Back) = Native Language Input
    const entry: DictionaryEntry = {
        id: Date.now().toString(),
        term: diaryResult, 
        targetTerm: diaryResult,
        nativeTerm: diaryInput,
        definition: diaryInput,
        examples: [],
        usageGuide: "Personal Diary Entry",
        timestamp: Date.now(),
        imageUrl: undefined
    };
    
    saveEntry(entry);
    setIsDiarySaved(true);
  };

  // --- Render Helpers ---

  const renderNav = () => (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-3 px-6 z-50 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button 
        onClick={() => setView(ViewState.HOME)} 
        className={`flex flex-col items-center gap-1 ${view === ViewState.HOME ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <Home size={24} />
        <span className="text-[10px] font-bold uppercase">Home</span>
      </button>
      <button 
        onClick={() => setView(ViewState.DIARY)} 
        className={`flex flex-col items-center gap-1 ${view === ViewState.DIARY ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <PenTool size={24} />
        <span className="text-[10px] font-bold uppercase">Diary</span>
      </button>
      <button 
        onClick={() => setView(ViewState.NOTEBOOK)} 
        className={`flex flex-col items-center gap-1 ${view === ViewState.NOTEBOOK ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <Book size={24} />
        <span className="text-[10px] font-bold uppercase">Notebook</span>
      </button>
      <button 
        onClick={() => { setCurrentFlashcardIndex(0); setView(ViewState.FLASHCARDS); }} 
        className={`flex flex-col items-center gap-1 ${view === ViewState.FLASHCARDS ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <GraduationCap size={24} />
        <span className="text-[10px] font-bold uppercase">Learn</span>
      </button>
    </nav>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 space-y-8 animate-fade-in-up">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">
          LinguaPop
        </h1>
        <p className="text-gray-500 font-medium">Your witty AI Language Companion</p>
      </div>

      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-xl border border-indigo-50 space-y-4">
        <div className="flex gap-4">
          <LanguageSelector 
            label="I speak" 
            value={settings.nativeLang} 
            onChange={(l) => setSettings({...settings, nativeLang: l})} 
          />
          <LanguageSelector 
            label="I'm learning" 
            value={settings.targetLang} 
            onChange={(l) => setSettings({...settings, targetLang: l})} 
          />
        </div>

        <form onSubmit={handleSearch} className="relative mt-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type a word or phrase..."
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl py-4 pl-5 pr-14 text-lg font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder-gray-400"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white rounded-xl px-4 hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
            <Search size={20} />
          </button>
        </form>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="pt-6 px-4">
      <button 
        onClick={() => setView(ViewState.HOME)}
        className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-indigo-600"
      >
        <ArrowLeft size={20} /> Back
      </button>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">Consulting the AI linguist...</p>
        </div>
      ) : currentResult ? (
        <ResultCard 
            entry={currentResult} 
            targetLang={settings.targetLang}
            onSave={saveEntry}
            isSaved={!!notebook.find(n => n.term === currentResult.term)}
        />
      ) : null}
    </div>
  );

  const renderNotebook = () => (
    <div className="pt-8 px-4 pb-24 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-gray-800">My Notebook</h2>
            <div className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full font-bold text-sm">
                {notebook.length} Saved
            </div>
        </div>

        {notebook.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <Book size={48} className="mx-auto mb-4 opacity-20" />
                <p>No words saved yet. Go search!</p>
            </div>
        ) : (
            <div className="space-y-4">
                <div className="bg-gradient-to-r from-amber-200 to-yellow-400 rounded-2xl p-6 shadow-lg text-amber-900 mb-8 relative overflow-hidden">
                    <Sparkles className="absolute top-4 right-4 opacity-50" />
                    <h3 className="text-xl font-bold mb-2">Story Time!</h3>
                    <p className="text-sm mb-4 font-medium opacity-80">Weave your saved words into a magical story.</p>
                    <button 
                        onClick={handleGenerateStory}
                        disabled={isStoryLoading}
                        className="bg-white text-amber-900 px-5 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-50 disabled:opacity-70 flex items-center gap-2"
                    >
                        {isStoryLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-amber-900 border-t-transparent rounded-full animate-spin"></div>
                                Writing...
                            </>
                        ) : (
                            "Generate Story"
                        )}
                    </button>

                    {story && (
                        <div className="mt-6 bg-white/90 p-4 rounded-xl relative group animate-fade-in-up">
                            <button 
                                onClick={handlePlayStory}
                                disabled={isPlayingStory}
                                className={`absolute top-4 right-4 p-2.5 rounded-full shadow-sm transition-all ${
                                    isPlayingStory 
                                        ? 'bg-indigo-600 text-white animate-pulse' 
                                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                }`}
                                title="Listen to story"
                            >
                                <Volume2 size={20} />
                            </button>
                            <div className="whitespace-pre-wrap font-medium text-sm leading-relaxed pr-12 text-gray-800">
                                {story}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid gap-3">
                    {notebook.map((item) => (
                        <div key={item.id} onClick={() => { setCurrentResult(item); setView(ViewState.RESULTS); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-200 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-gray-800">{item.targetTerm || item.term}</span>
                                <span className="text-xs text-gray-400 font-medium">{item.nativeTerm || item.term}</span>
                            </div>
                            <span className="text-sm text-gray-400 truncate max-w-[40%] text-right">{item.definition}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );

  const renderDiary = () => (
    <div className="pt-8 px-4 pb-24 max-w-2xl mx-auto flex flex-col h-[90vh]">
        <h2 className="text-3xl font-black text-gray-800 mb-6">Language Diary</h2>
        
        <div className="flex-1 flex flex-col gap-4">
            <div className="bg-white rounded-3xl shadow-sm border border-indigo-100 p-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">
                    Write in {settings.nativeLang}
                </label>
                <textarea
                    value={diaryInput}
                    onChange={(e) => setDiaryInput(e.target.value)}
                    placeholder="How was your day? Write anything here..."
                    className="w-full h-32 bg-gray-50 rounded-xl p-4 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-shadow"
                />
                <button
                    onClick={handleTranslateDiary}
                    disabled={isTranslating || !diaryInput.trim()}
                    className="self-end bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {isTranslating ? (
                         <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Translating...
                        </>
                    ) : (
                        <>Translate <PenTool size={16} /></>
                    )}
                </button>
            </div>

            {diaryResult && (
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-xl text-white animate-fade-in-up relative">
                     <label className="text-xs font-bold text-white/50 uppercase tracking-wide mb-2 block">
                        In {settings.targetLang}
                    </label>
                    <p className="text-xl font-medium leading-relaxed mb-8">
                        {diaryResult}
                    </p>
                    
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <button
                            onClick={handlePlayDiary}
                            disabled={isPlayingDiary}
                            className={`p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all ${isPlayingDiary ? 'animate-pulse ring-2 ring-white/50' : ''}`}
                            title="Listen"
                        >
                            <Volume2 size={24} />
                        </button>

                        <button
                            onClick={handleCopyDiary}
                            className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                            title="Copy text"
                        >
                           {isCopied ? <Check size={24} /> : <Copy size={24} />}
                        </button>

                         <button
                            onClick={handleSaveDiary}
                            disabled={isDiarySaved}
                            className={`p-3 rounded-full backdrop-blur-md transition-all ${isDiarySaved ? 'bg-green-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                            title="Save to Notebook"
                        >
                            {isDiarySaved ? <Check size={24} /> : <Book size={24} />}
                        </button>
                    </div>
                </div>
            )}
            
            {!diaryResult && !isTranslating && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-4">
                    <PenTool size={48} className="opacity-20" />
                    <p className="text-sm font-medium">Practice writing every day!</p>
                </div>
            )}
        </div>
    </div>
  );

  const renderFlashcards = () => {
    if (notebook.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center">
                <GraduationCap size={64} className="text-indigo-200 mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Class is empty!</h2>
                <p className="text-gray-500">Save some words to your notebook to start learning.</p>
                <button onClick={() => setView(ViewState.HOME)} className="mt-6 text-indigo-600 font-bold">Go to Search</button>
            </div>
        )
    }

    const currentCard = notebook[currentFlashcardIndex];

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] px-6 pb-20">
            <h2 className="text-2xl font-black text-gray-800 mb-8 tracking-tight">Daily Review</h2>
            
            <Flashcard entry={currentCard} />
            
            <div className="flex items-center gap-6 mt-10">
                <button 
                    disabled={currentFlashcardIndex === 0}
                    onClick={() => setCurrentFlashcardIndex(prev => prev - 1)}
                    className="p-4 rounded-full bg-white shadow-md text-gray-600 disabled:opacity-30 hover:bg-gray-50"
                >
                    <ArrowLeft size={24} />
                </button>
                <span className="font-bold text-gray-400 text-sm">
                    {currentFlashcardIndex + 1} / {notebook.length}
                </span>
                <button 
                    disabled={currentFlashcardIndex === notebook.length - 1}
                    onClick={() => setCurrentFlashcardIndex(prev => prev + 1)}
                    className="p-4 rounded-full bg-white shadow-md text-gray-600 disabled:opacity-30 hover:bg-gray-50"
                >
                    <ArrowLeft size={24} className="rotate-180" />
                </button>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <main className="max-w-3xl mx-auto">
        {view === ViewState.HOME && renderHome()}
        {view === ViewState.RESULTS && renderResults()}
        {view === ViewState.NOTEBOOK && renderNotebook()}
        {view === ViewState.FLASHCARDS && renderFlashcards()}
        {view === ViewState.DIARY && renderDiary()}
      </main>
      {renderNav()}
    </div>
  );
};

export default App;