import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── API base ──────────────────────────────────────────────────────────────

const BASE = "/api";
const TOKEN_KEY = "llm-studio-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Headers including the auth token (if present). Use for raw fetch calls. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(init?.headers as Record<string, string> | undefined),
    ...init,
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
    const err = await res.json().catch(() => ({ error: "Not authenticated" }));
    throw new Error((err as { error?: string }).error ?? "Not authenticated");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Conversation {
  id: number;
  title: string;
  model: string;
  systemPrompt: string | null;
  useKnowledgeBase: boolean;
  useWebSearch: boolean;
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

export type KeySource = "user" | "env" | "none";

export interface ProviderKeyStatus {
  hasKey: boolean;
  keyPreview: string | null;
  source: KeySource;
}

export interface Settings {
  hasKey: boolean;
  keyPreview: string | null;
  source: KeySource;
  openai: ProviderKeyStatus;
  tavily: ProviderKeyStatus;
  together: ProviderKeyStatus;
  mistral: ProviderKeyStatus;
}

export interface Stats {
  conversations: number;
  messages: number;
  documents: number;
  memories: number;
}

export interface TrainingJob {
  id: number;
  name: string;
  provider: string;
  baseModel: string;
  status: string;
  source: string;
  exampleCount: number;
  fineTunedModel: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FineTuneBaseModel {
  id: string;
  name: string;
  note: string;
  provider: "openai" | "together" | "mistral";
}

export interface TrainingExample {
  system?: string;
  prompt: string;
  completion: string;
}

export interface TrainingHyperparameters {
  nEpochs?: number;
  batchSize?: number;
  learningRate?: number; // Together AI / Mistral: absolute learning rate (e.g. 0.00001)
  learningRateMultiplier?: number; // OpenAI: multiplier applied to its default
  loraR?: number; // Together AI LoRA rank
  loraAlpha?: number; // Together AI LoRA alpha
  trainingSteps?: number; // Mistral: number of gradient update steps
}

export interface CreateTrainingJobInput {
  name: string;
  baseModel: string;
  source: "conversations" | "examples" | "jsonl";
  conversationIds?: number[];
  examples?: TrainingExample[];
  jsonl?: string;
  hyperparameters?: TrainingHyperparameters;
}

// ─── API calls ─────────────────────────────────────────────────────────────

export const api = {
  // Auth
  signup: (data: { username: string; password: string; displayName?: string }) =>
    apiFetch<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    apiFetch<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch<{ user: User }>("/auth/me"),
  updateProfile: (displayName: string) =>
    apiFetch<{ user: User }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ ok: boolean }>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Conversations
  listConversations: () => apiFetch<Conversation[]>("/conversations"),
  getConversation: (id: number) => apiFetch<ConversationWithMessages>(`/conversations/${id}`),
  createConversation: (data: { title?: string; model?: string; systemPrompt?: string; useKnowledgeBase?: boolean; useWebSearch?: boolean }) =>
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
  setOpenAIKey: (openaiApiKey: string) =>
    apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify({ openaiApiKey }) }),
  deleteOpenAIKey: () => apiFetch<Settings>("/settings?provider=openai", { method: "DELETE" }),
  setTavilyKey: (tavilyApiKey: string) =>
    apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify({ tavilyApiKey }) }),
  deleteTavilyKey: () => apiFetch<Settings>("/settings?provider=tavily", { method: "DELETE" }),
  setTogetherKey: (togetherApiKey: string) =>
    apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify({ togetherApiKey }) }),
  deleteTogetherKey: () => apiFetch<Settings>("/settings?provider=together", { method: "DELETE" }),
  setMistralKey: (mistralApiKey: string) =>
    apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify({ mistralApiKey }) }),
  deleteMistralKey: () => apiFetch<Settings>("/settings?provider=mistral", { method: "DELETE" }),

  // Training / fine-tuning
  getTrainingBaseModels: () =>
    apiFetch<{ baseModels: FineTuneBaseModel[]; minExamples: number }>("/training/base-models"),
  listTrainingJobs: () => apiFetch<TrainingJob[]>("/training/jobs"),
  createTrainingJob: (data: CreateTrainingJobInput) =>
    apiFetch<TrainingJob>("/training/jobs", { method: "POST", body: JSON.stringify(data) }),
  refreshTrainingJob: (id: number) =>
    apiFetch<TrainingJob>(`/training/jobs/${id}/refresh`, { method: "POST" }),
  deleteTrainingJob: (id: number) =>
    apiFetch<void>(`/training/jobs/${id}`, { method: "DELETE" }),

  // Stats
  getStats: () => apiFetch<Stats>("/stats"),
};
