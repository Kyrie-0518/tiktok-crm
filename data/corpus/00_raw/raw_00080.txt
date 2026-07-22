import { create } from 'zustand';
import api from '../api';

interface ChatRecord {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
}

interface AIState {
  apiKey: string | null;
  apiBase: string;
  model: string;
  chatHistory: ChatRecord[];
  configLoaded: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (apiKey: string, apiBase: string, model: string) => Promise<void>;
  addHistory: (question: string, answer: string) => void;
  clearHistory: () => void;
}

function loadHistory(): ChatRecord[] {
  try {
    const raw = localStorage.getItem('ai_chat_history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: ChatRecord[]) {
  localStorage.setItem('ai_chat_history', JSON.stringify(records.slice(-50)));
}

export const useAIStore = create<AIState>((set, get) => ({
  apiKey: null,
  apiBase: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  chatHistory: loadHistory(),
  configLoaded: false,

  loadConfig: async () => {
    try {
      const { data } = await api.get('/ai/config');
      set({ apiKey: data.api_key || null, apiBase: data.api_base || 'https://api.deepseek.com/v1', model: data.model || 'deepseek-chat', configLoaded: true });
    } catch {
      set({ configLoaded: true });
    }
  },

  saveConfig: async (apiKey, apiBase, model) => {
    await api.put('/ai/config', { api_key: apiKey, api_base: apiBase, model });
    set({ apiKey, apiBase, model });
  },

  addHistory: (question, answer) => {
    const record: ChatRecord = {
      id: Date.now().toString(),
      question,
      answer,
      timestamp: Date.now(),
    };
    const updated = [...get().chatHistory, record].slice(-50);
    saveHistory(updated);
    set({ chatHistory: updated });
  },

  clearHistory: () => {
    localStorage.removeItem('ai_chat_history');
    set({ chatHistory: [] });
  },
}));
