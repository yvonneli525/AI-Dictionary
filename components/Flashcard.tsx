import React, { useState } from 'react';
import { DictionaryEntry } from '../types';
import { RotateCw } from 'lucide-react';

interface Props {
  entry: DictionaryEntry;
}

export const Flashcard: React.FC<Props> = ({ entry }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
        className="group h-96 w-full max-w-sm perspective-1000 cursor-pointer mx-auto"
        onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative h-full w-full transition-all duration-500 preserve-3d transform ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* Front */}
        <div className="absolute h-full w-full backface-hidden rounded-3xl shadow-2xl overflow-hidden bg-white border border-gray-100 flex flex-col">
            <div className="h-3/5 bg-indigo-50 relative">
                 {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.term} className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-200">No Image</div>
                 )}
                 <div className="absolute top-4 right-4 bg-white/80 p-2 rounded-full backdrop-blur-sm text-indigo-600">
                    <RotateCw size={16} />
                 </div>
            </div>
            <div className="h-2/5 flex flex-col items-center justify-center p-4 bg-white">
                <h2 className="text-3xl font-black text-gray-800 text-center">{entry.term}</h2>
                <p className="text-xs text-gray-400 mt-2 uppercase tracking-widest font-bold">Tap to flip</p>
            </div>
        </div>

        {/* Back */}
        <div className="absolute h-full w-full backface-hidden rotate-y-180 rounded-3xl shadow-2xl overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-8 flex flex-col justify-center text-center">
             <h3 className="text-sm font-bold opacity-50 uppercase tracking-widest mb-2">Meaning</h3>
             <p className="text-xl font-bold mb-6 leading-snug">{entry.definition}</p>
             
             <div className="w-12 h-1 bg-white/20 mx-auto rounded-full mb-6"></div>

             <h3 className="text-sm font-bold opacity-50 uppercase tracking-widest mb-2">Example</h3>
             <p className="text-lg italic opacity-90">"{entry.examples[0]?.target}"</p>
        </div>
      </div>
    </div>
  );
};
