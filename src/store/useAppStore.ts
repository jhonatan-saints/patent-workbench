import { create } from 'zustand';

type AppState = {
  currentIdea: string | null;
  generatedText: string;
  history: string[];
  setCurrentIdea: (v: string | null) => void;
  setGeneratedText: (v: string) => void;
  addHistory: (v: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentIdea: null,
  generatedText: '',
  history: [],
  setCurrentIdea: (currentIdea) => set({ currentIdea }),
  setGeneratedText: (generatedText) => set({ generatedText }),
  addHistory: (item) => set((state) => ({ history: [item, ...state.history].slice(0, 100) })),
}));
