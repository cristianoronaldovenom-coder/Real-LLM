import OpenAI from "openai";
import { db, settings, SETTINGS_ROW_ID } from "../db.js";
import { eq } from "drizzle-orm";

export type KeySource = "user" | "env" | "none";

const CACHE_TTL_MS = 30_000;
let cache: { key: string | null; fetchedAt: number } | null = null;

async function readUserKey(): Promise<string | null> {
  const [row] = await db
    .select({ key: settings.openrouterApiKey })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ROW_ID))
    .limit(1);
  const key = row?.key?.trim();
  return key ? key : null;
}

export function invalidateKeyCache(): void {
  cache = null;
}

async function getUserKey(): Promise<string | null> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.key;
  const key = await readUserKey();
  cache = { key, fetchedAt: now };
  return key;
}

export async function resolveApiKey(): Promise<{ key: string | null; source: KeySource }> {
  const userKey = await getUserKey();
  if (userKey) return { key: userKey, source: "user" };
  const envKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  if (envKey) return { key: envKey, source: "env" };
  return { key: null, source: "none" };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No OpenRouter API key is configured. Add your key on the Settings page, or set the OPENROUTER_API_KEY env variable."
    );
    this.name = "MissingApiKeyError";
  }
}

export async function getOpenRouterClient(): Promise<OpenAI> {
  const { key } = await resolveApiKey();
  if (!key) throw new MissingApiKeyError();
  return new OpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://llm-studio.local",
      "X-Title": "LLM Studio",
    },
  });
}
