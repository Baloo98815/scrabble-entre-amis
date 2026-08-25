import { api } from './http.js';

export function addDictionaryWord(word: string): Promise<{ word: string }> {
  return api.post<{ word: string }>('/admin/dictionary', { word });
}

export function removeDictionaryWord(word: string): Promise<{ word: string }> {
  return api.delete<{ word: string }>(`/admin/dictionary/${encodeURIComponent(word)}`);
}
