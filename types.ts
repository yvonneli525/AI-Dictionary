export enum ViewState {
  HOME = 'HOME',
  RESULTS = 'RESULTS',
  NOTEBOOK = 'NOTEBOOK',
  FLASHCARDS = 'FLASHCARDS',
  DIARY = 'DIARY'
}

export enum SupportedLanguage {
  ENGLISH = 'English',
  CHINESE = 'Chinese (Simplified)',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  PORTUGUESE = 'Portuguese',
  RUSSIAN = 'Russian',
  ITALIAN = 'Italian'
}

export interface ExampleSentence {
  target: string;
  native: string;
}

export interface DictionaryEntry {
  id: string; // unique ID for React keys
  term: string; // The original search term entered by user
  targetTerm: string; // The word/phrase in the target language
  nativeTerm: string; // The word/phrase in the native language
  definition: string; // Native language explanation
  examples: ExampleSentence[];
  usageGuide: string; // The chatty, fun explanation
  imageUrl?: string; // Base64 or URL
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AppSettings {
  nativeLang: SupportedLanguage;
  targetLang: SupportedLanguage;
}