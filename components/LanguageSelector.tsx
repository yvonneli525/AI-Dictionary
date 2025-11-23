import React from 'react';
import { SupportedLanguage } from '../types';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  value: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
}

export const LanguageSelector: React.FC<Props> = ({ label, value, onChange }) => {
  return (
    <div className="flex flex-col w-full">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SupportedLanguage)}
          className="appearance-none w-full bg-white border-2 border-indigo-100 text-gray-800 font-medium py-3 px-4 pr-8 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all cursor-pointer shadow-sm"
        >
          {Object.values(SupportedLanguage).map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-500">
          <ChevronDown size={18} />
        </div>
      </div>
    </div>
  );
};
