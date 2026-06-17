export interface AiModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
}

const CURATED_MODELS: AiModel[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    description: "Meta's flagship open model. Strong all-round reasoning, writing, and instruction following.",
    contextLength: 131072,
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    description: "A smaller, fast Llama model. Great for quick replies and everyday chat.",
    contextLength: 131072,
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    description: "Alibaba's powerful multilingual model with excellent reasoning and long-context handling.",
    contextLength: 131072,
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct",
    name: "Qwen 2.5 Coder 32B",
    provider: "Alibaba",
    description: "Specialized for programming, code explanation, and technical tasks.",
    contextLength: 128000,
  },
  {
    id: "deepseek/deepseek-chat-v3.1",
    name: "DeepSeek V3.1",
    provider: "DeepSeek",
    description: "A highly capable reasoning model with very long context.",
    contextLength: 163840,
  },
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3 27B",
    provider: "Google",
    description: "Google's open model. Balanced, helpful, and good with nuanced instructions.",
    contextLength: 131072,
  },
  {
    id: "mistralai/mistral-nemo",
    name: "Mistral Nemo",
    provider: "Mistral AI",
    description: "An efficient European model with strong multilingual ability.",
    contextLength: 131072,
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "Meta",
    description: "The previous-generation Llama flagship. Dependable for general conversation and analysis.",
    contextLength: 131072,
  },
];

export const DEFAULT_MODEL = CURATED_MODELS[0].id;

const OPEN_SOURCE_PREFIXES = [
  "meta-llama/", "qwen/", "mistralai/", "deepseek/", "microsoft/",
  "nousresearch/", "cognitivecomputations/", "nvidia/", "gryphe/",
  "openchat/", "teknium/", "huggingfaceh4/", "sao10k/", "liquid/",
  "allenai/", "thedrummer/", "moonshotai/", "z-ai/", "tngtech/",
  "agentica-org/", "arcee-ai/",
];

const PROVIDER_NAMES: Record<string, string> = {
  "meta-llama": "Meta", qwen: "Alibaba", mistralai: "Mistral AI",
  deepseek: "DeepSeek", google: "Google", microsoft: "Microsoft",
  nousresearch: "Nous Research", nvidia: "NVIDIA", allenai: "Allen AI",
  moonshotai: "Moonshot AI", "arcee-ai": "Arcee AI",
};

function isOpenSource(id: string): boolean {
  if (id.startsWith("google/")) return id.includes("gemma");
  return OPEN_SOURCE_PREFIXES.some((p) => id.startsWith(p));
}

function providerName(id: string): string {
  const slug = id.split("/")[0]!;
  return PROVIDER_NAMES[slug] ?? slug.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
}

function cleanName(id: string, rawName?: string): string {
  if (rawName) {
    const stripped = rawName.includes(":") ? rawName.slice(rawName.indexOf(":") + 1).trim() : rawName;
    return stripped.replace(/\s*\(free\)\s*$/i, "").trim();
  }
  return id.split("/")[1] ?? id;
}

function cleanDescription(desc: string | undefined, name: string): string {
  if (!desc?.trim()) return `${name} — an open-source model available through OpenRouter.`;
  const oneLine = desc.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 200) return oneLine;
  const cut = oneLine.slice(0, 200);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
}

const CATALOG_CACHE_TTL = 60 * 60 * 1000;
let catalogCache: { models: AiModel[]; fetchedAt: number } | null = null;

async function fetchCatalog(): Promise<AiModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter models request failed: ${res.status}`);
  const json = (await res.json()) as { data: OpenRouterModel[] };

  const curatedIds = new Set(CURATED_MODELS.map((m) => m.id));
  const extras: AiModel[] = [];

  for (const m of json.data) {
    if (!m.id || curatedIds.has(m.id)) continue;
    if (m.id.endsWith(":free")) continue;
    if (!isOpenSource(m.id)) continue;
    if (!m.context_length) continue;
    const name = cleanName(m.id, m.name);
    extras.push({ id: m.id, name, provider: providerName(m.id), description: cleanDescription(m.description, name), contextLength: m.context_length });
  }
  extras.sort((a, b) => a.provider === b.provider ? a.name.localeCompare(b.name) : a.provider.localeCompare(b.provider));
  return [...CURATED_MODELS, ...extras];
}

export async function getModels(): Promise<AiModel[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL) return catalogCache.models;
  try {
    const models = await fetchCatalog();
    catalogCache = { models, fetchedAt: now };
    return models;
  } catch {
    return catalogCache?.models ?? CURATED_MODELS;
  }
}

export function normalizeModel(model: string | undefined): string {
  const trimmed = model?.trim();
  return trimmed ? trimmed : DEFAULT_MODEL;
}
