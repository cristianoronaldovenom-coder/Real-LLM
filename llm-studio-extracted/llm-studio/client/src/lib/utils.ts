import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── API base ──────────────────────────────────────────────────────────────

const BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  title: string;
  model: string;
  systemPrompt: string | null;
  useKnowledgeBase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface AiModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
}

export interface Document {
  id: number;
  name: string;
  type: string;
  preview: string;
  charCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface Memory {
  id: number;
  content: string;
  source: string;
  createdAt: string;
}

export interface Settings {
  hasKey: boolean;
  keyPreview: string | null;
  source: "user" | "env" | "none";
}

export interface Stats {
  conversations: number;
  messages: number;
  documents: number;
  memories: number;
}

// ─── API calls ─────────────────────────────────────────────────────────────

export const api = {
  // Conversations
  listConversations: () => apiFetch<Conversation[]>("/conversations"),
  getConversation: (id: number) => apiFetch<ConversationWithMessages>(`/conversations/${id}`),
  createConversation: (data: { title?: string; model?: string; systemPrompt?: string; useKnowledgeBase?: boolean }) =>
    apiFetch<Conversation>("/conversations", { method: "POST", body: JSON.stringify(data) }),
  updateConversation: (id: number, data: Partial<Omit<Conversation, "id" | "createdAt" | "updatedAt">>) =>
    apiFetch<Conversation>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteConversation: (id: number) => apiFetch<void>(`/conversations/${id}`, { method: "DELETE" }),

  // Models
  listModels: () => apiFetch<AiModel[]>("/models"),

  // Documents
  listDocuments: () => apiFetch<Document[]>("/documents"),
  createDocument: (data: { name: string; content: string; type?: string }) =>
    apiFetch<Document>("/documents", { method: "POST", body: JSON.stringify(data) }),
  deleteDocument: (id: number) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),

  // Memories
  listMemories: () => apiFetch<Memory[]>("/memories"),
  createMemory: (content: string) =>
    apiFetch<Memory>("/memories", { method: "POST", body: JSON.stringify({ content }) }),
  deleteMemory: (id: number) => apiFetch<void>(`/memories/${id}`, { method: "DELETE" }),
  clearMemories: () => apiFetch<void>("/memories", { method: "DELETE" }),

  // Settings
  getSettings: () => apiFetch<Settings>("/settings"),
  updateSettings: (openrouterApiKey: string) =>
    apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify({ openrouterApiKey }) }),
  deleteSettings: () => apiFetch<Settings>("/settings", { method: "DELETE" }),

  // Stats
  getStats: () => apiFetch<Stats>("/stats"),
};
