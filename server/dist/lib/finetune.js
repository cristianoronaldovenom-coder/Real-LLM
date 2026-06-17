import { toFile } from "openai";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, conversations, messages, trainingJobs } from "../db.js";
import { getOpenAIClient, resolveOpenAIKey, MissingOpenAIKeyError } from "./openai.js";
import { resolveTogetherKey, MissingTogetherKeyError, uploadTrainingFile as togetherUpload, createFineTune as togetherCreateFineTune, retrieveFineTune as togetherRetrieve, cancelFineTune as togetherCancel, TOGETHER_PREFIX, } from "./together.js";
import { resolveMistralKey, MissingMistralKeyError, uploadTrainingFile as mistralUpload, createFineTune as mistralCreateFineTune, retrieveFineTune as mistralRetrieve, cancelFineTune as mistralCancel, MISTRAL_PREFIX, } from "./mistral.js";
export const MIN_EXAMPLES = 10;
export const FINE_TUNE_BASE_MODELS = [
    { id: "gpt-4o-mini-2024-07-18", name: "GPT-4o mini", note: "Recommended — fast and affordable" },
    { id: "gpt-4.1-mini-2025-04-14", name: "GPT-4.1 mini", note: "Newer, balanced quality" },
    { id: "gpt-4.1-nano-2025-04-14", name: "GPT-4.1 nano", note: "Smallest and cheapest" },
    { id: "gpt-3.5-turbo-0125", name: "GPT-3.5 Turbo", note: "Legacy, very cheap" },
];
// Open-weight models fine-tunable via Together AI (LoRA). These ids must match
// Together's fine-tunable catalog; an unknown id surfaces as a Together error.
export const TOGETHER_BASE_MODELS = [
    { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Reference", name: "Llama 3.1 8B Instruct", note: "Meta — fast & affordable" },
    { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Reference", name: "Llama 3.1 70B Instruct", note: "Meta — higher quality" },
    { id: "Qwen/Qwen2.5-7B-Instruct", name: "Qwen 2.5 7B Instruct", note: "Alibaba — fast multilingual" },
    { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B Instruct", note: "Alibaba — top quality" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B Instruct", note: "Mistral — efficient" },
];
// Mistral's own open models, fine-tunable directly through Mistral AI. These ids
// must match Mistral's fine-tunable catalog; an unknown id surfaces as an error.
export const MISTRAL_BASE_MODELS = [
    { id: "open-mistral-7b", name: "Mistral 7B", note: "Mistral — fast & affordable" },
    { id: "mistral-small-latest", name: "Mistral Small", note: "Mistral — higher quality" },
    { id: "codestral-latest", name: "Codestral", note: "Mistral — best for code" },
];
export function getBaseModels() {
    return [
        ...FINE_TUNE_BASE_MODELS.map((m) => ({ ...m, provider: "openai" })),
        ...TOGETHER_BASE_MODELS.map((m) => ({ ...m, provider: "together" })),
        ...MISTRAL_BASE_MODELS.map((m) => ({ ...m, provider: "mistral" })),
    ];
}
function providerForBaseModel(id) {
    if (FINE_TUNE_BASE_MODELS.some((m) => m.id === id))
        return "openai";
    if (TOGETHER_BASE_MODELS.some((m) => m.id === id))
        return "together";
    if (MISTRAL_BASE_MODELS.some((m) => m.id === id))
        return "mistral";
    return null;
}
/** Together suffixes must be short and alphanumeric-ish; derive one from the name. */
function suffixFromName(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return slug || undefined;
}
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
export class TrainingValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "TrainingValidationError";
    }
}
function exampleToMessages(ex) {
    const msgs = [];
    if (ex.system?.trim())
        msgs.push({ role: "system", content: ex.system.trim() });
    msgs.push({ role: "user", content: ex.prompt.trim() });
    msgs.push({ role: "assistant", content: ex.completion.trim() });
    return msgs;
}
export function examplesToJsonl(examples) {
    return examples.map((messages) => JSON.stringify({ messages })).join("\n") + "\n";
}
/**
 * Mistral requires messages to strictly alternate user/assistant (after an
 * optional leading system message) and to end on an assistant turn. Real
 * conversations often have two user messages in a row (or a trailing question
 * with no answer), which Mistral rejects with "Unexpected role 'user' after
 * role 'user'". This collapses consecutive same-role turns into one and trims
 * the ends so each example is a valid alternating exchange.
 */
function normalizeAlternating(msgs) {
    let system;
    const merged = [];
    for (const m of msgs) {
        if (m.role === "system") {
            if (!system)
                system = { role: "system", content: m.content };
            else
                system.content += "\n\n" + m.content;
            continue;
        }
        const last = merged[merged.length - 1];
        if (last && last.role === m.role) {
            last.content += "\n\n" + m.content;
        }
        else {
            merged.push({ role: m.role, content: m.content });
        }
    }
    while (merged.length && merged[0].role === "assistant")
        merged.shift();
    while (merged.length && merged[merged.length - 1].role === "user")
        merged.pop();
    return system ? [system, ...merged] : merged;
}
export function buildFromExamples(examples) {
    return examples
        .filter((e) => e.prompt?.trim() && e.completion?.trim())
        .map(exampleToMessages);
}
export function buildFromJsonl(jsonl) {
    const out = [];
    const lines = jsonl.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
        let obj;
        try {
            obj = JSON.parse(line);
        }
        catch {
            throw new TrainingValidationError(`Invalid JSON on a line: ${line.slice(0, 80)}…`);
        }
        const record = obj;
        if (!record || !Array.isArray(record.messages)) {
            throw new TrainingValidationError('Each line must be a JSON object with a "messages" array.');
        }
        const parsed = [];
        for (const raw of record.messages) {
            const m = raw;
            if (typeof m.content !== "string" ||
                (m.role !== "system" && m.role !== "user" && m.role !== "assistant")) {
                throw new TrainingValidationError("Each message needs a role of system/user/assistant and string content.");
            }
            parsed.push({ role: m.role, content: m.content });
        }
        if (!parsed.some((m) => m.role === "user") || !parsed.some((m) => m.role === "assistant")) {
            throw new TrainingValidationError("Each example must include a user and an assistant message.");
        }
        out.push(parsed);
    }
    return out;
}
export async function buildFromConversations(ids) {
    const convos = ids && ids.length > 0
        ? await db.select().from(conversations).where(inArray(conversations.id, ids))
        : await db.select().from(conversations);
    const out = [];
    for (const c of convos) {
        const msgs = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, c.id))
            .orderBy(asc(messages.createdAt), asc(messages.id));
        const chat = [];
        if (c.systemPrompt?.trim())
            chat.push({ role: "system", content: c.systemPrompt.trim() });
        for (const m of msgs) {
            if (m.role === "user" || m.role === "assistant") {
                chat.push({ role: m.role, content: m.content });
            }
        }
        if (chat.some((m) => m.role === "user") && chat.some((m) => m.role === "assistant")) {
            out.push(chat);
        }
    }
    return out;
}
export async function buildExamples(params) {
    if (params.source === "conversations")
        return buildFromConversations(params.conversationIds);
    if (params.source === "jsonl")
        return buildFromJsonl(params.jsonl ?? "");
    return buildFromExamples(params.examples ?? []);
}
export async function createTrainingJob(params) {
    const provider = providerForBaseModel(params.baseModel);
    if (!provider) {
        throw new TrainingValidationError("Unsupported base model. Choose one of the listed fine-tunable models.");
    }
    const examples = await buildExamples(params);
    if (examples.length < MIN_EXAMPLES) {
        throw new TrainingValidationError(`Fine-tuning needs at least ${MIN_EXAMPLES} examples. You provided ${examples.length}. ` +
            "Add more conversations or examples and try again.");
    }
    const jsonl = examplesToJsonl(examples);
    // Upload the file and create the job first. We only persist a row once the
    // provider accepts it, so a rejection surfaces as a real error instead of a
    // confusing "failed" row the user has to clean up.
    if (provider === "together") {
        const { key } = await resolveTogetherKey();
        if (!key)
            throw new MissingTogetherKeyError();
        const fileId = await togetherUpload(jsonl);
        const hp = params.hyperparameters;
        const job = await togetherCreateFineTune({
            trainingFileId: fileId,
            model: params.baseModel,
            suffix: suffixFromName(params.name),
            hyperparameters: hp && {
                nEpochs: hp.nEpochs,
                batchSize: hp.batchSize,
                learningRate: hp.learningRate,
                loraR: hp.loraR,
                loraAlpha: hp.loraAlpha,
            },
        });
        const [row] = await db
            .insert(trainingJobs)
            .values({
            name: params.name,
            provider,
            baseModel: params.baseModel,
            source: params.source,
            exampleCount: examples.length,
            status: job.status,
            providerFileId: fileId,
            providerJobId: job.id,
            fineTunedModel: job.outputName,
        })
            .returning();
        return row;
    }
    if (provider === "mistral") {
        const { key } = await resolveMistralKey();
        if (!key)
            throw new MissingMistralKeyError();
        const mistralExamples = examples
            .map(normalizeAlternating)
            .filter((m) => m.some((x) => x.role === "user") && m.some((x) => x.role === "assistant"));
        if (mistralExamples.length < MIN_EXAMPLES) {
            throw new TrainingValidationError(`After formatting for Mistral, only ${mistralExamples.length} usable example(s) remained ` +
                `(need at least ${MIN_EXAMPLES}). Mistral requires each example to have alternating ` +
                "user and assistant turns ending with an assistant reply. Add more complete exchanges and try again.");
        }
        const fileId = await mistralUpload(examplesToJsonl(mistralExamples));
        const hp = params.hyperparameters;
        const job = await mistralCreateFineTune({
            trainingFileId: fileId,
            model: params.baseModel,
            hyperparameters: hp && {
                trainingSteps: hp.trainingSteps,
                learningRate: hp.learningRate,
            },
        });
        const [row] = await db
            .insert(trainingJobs)
            .values({
            name: params.name,
            provider,
            baseModel: params.baseModel,
            source: params.source,
            exampleCount: mistralExamples.length,
            status: job.status,
            providerFileId: fileId,
            providerJobId: job.id,
            fineTunedModel: job.outputName,
        })
            .returning();
        return row;
    }
    const { key } = await resolveOpenAIKey();
    if (!key)
        throw new MissingOpenAIKeyError();
    const client = await getOpenAIClient();
    const file = await client.files.create({
        file: await toFile(Buffer.from(jsonl, "utf-8"), `training-${Date.now()}.jsonl`),
        purpose: "fine-tune",
    });
    const hp = params.hyperparameters;
    const openaiHyper = {};
    if (hp?.nEpochs != null)
        openaiHyper.n_epochs = hp.nEpochs;
    if (hp?.batchSize != null)
        openaiHyper.batch_size = hp.batchSize;
    if (hp?.learningRateMultiplier != null)
        openaiHyper.learning_rate_multiplier = hp.learningRateMultiplier;
    const job = await client.fineTuning.jobs.create({
        training_file: file.id,
        model: params.baseModel,
        ...(Object.keys(openaiHyper).length > 0 ? { hyperparameters: openaiHyper } : {}),
    });
    const [row] = await db
        .insert(trainingJobs)
        .values({
        name: params.name,
        provider,
        baseModel: params.baseModel,
        source: params.source,
        exampleCount: examples.length,
        status: job.status,
        providerFileId: file.id,
        providerJobId: job.id,
        fineTunedModel: job.fine_tuned_model ?? null,
    })
        .returning();
    return row;
}
export async function listTrainingJobs() {
    return db.select().from(trainingJobs).orderBy(desc(trainingJobs.createdAt));
}
/** Fetches the latest provider status for a job row. Throws on provider error. */
async function fetchProviderStatus(row) {
    if (row.provider === "together") {
        const job = await togetherRetrieve(row.providerJobId);
        return { status: job.status, fineTunedModel: job.outputName, error: job.error };
    }
    if (row.provider === "mistral") {
        const job = await mistralRetrieve(row.providerJobId);
        return { status: job.status, fineTunedModel: job.outputName, error: job.error };
    }
    const client = await getOpenAIClient();
    const job = await client.fineTuning.jobs.retrieve(row.providerJobId);
    return {
        status: job.status,
        fineTunedModel: job.fine_tuned_model ?? null,
        error: job.error?.message ?? null,
    };
}
export async function syncTrainingJob(id) {
    const [row] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id));
    if (!row)
        return null;
    if (!row.providerJobId || TERMINAL_STATUSES.has(row.status))
        return row;
    try {
        const patch = await fetchProviderStatus(row);
        const [updated] = await db
            .update(trainingJobs)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(trainingJobs.id, id))
            .returning();
        return updated;
    }
    catch {
        // A transient status-check failure should not corrupt the stored record.
        return row;
    }
}
// Throttled background sync so polling (GET /training/jobs) and the model list
// (GET /models) reflect real provider status without hammering their APIs.
const ACTIVE_SYNC_INTERVAL_MS = 10_000;
let lastActiveSync = 0;
let activeSyncInFlight = null;
export async function syncActiveTrainingJobs(force = false) {
    if (activeSyncInFlight)
        return activeSyncInFlight;
    const now = Date.now();
    if (!force && now - lastActiveSync < ACTIVE_SYNC_INTERVAL_MS)
        return;
    activeSyncInFlight = (async () => {
        const rows = await db.select().from(trainingJobs);
        const active = rows.filter((r) => r.providerJobId && !TERMINAL_STATUSES.has(r.status));
        if (active.length === 0)
            return;
        await Promise.all(active.map(async (r) => {
            try {
                const patch = await fetchProviderStatus(r);
                await db
                    .update(trainingJobs)
                    .set({ ...patch, updatedAt: new Date() })
                    .where(eq(trainingJobs.id, r.id));
            }
            catch {
                // Per-job transient failure (or missing key); other jobs still sync.
            }
        }));
    })();
    try {
        await activeSyncInFlight;
        lastActiveSync = Date.now();
    }
    finally {
        activeSyncInFlight = null;
    }
}
export async function deleteTrainingJob(id) {
    const [row] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id));
    if (!row)
        return false;
    if (row.providerJobId && !TERMINAL_STATUSES.has(row.status)) {
        try {
            if (row.provider === "together") {
                await togetherCancel(row.providerJobId);
            }
            else if (row.provider === "mistral") {
                await mistralCancel(row.providerJobId);
            }
            else {
                const client = await getOpenAIClient();
                await client.fineTuning.jobs.cancel(row.providerJobId);
            }
        }
        catch {
            // Best-effort cancel; deletion proceeds regardless.
        }
    }
    await db.delete(trainingJobs).where(eq(trainingJobs.id, id));
    return true;
}
export async function getFineTunedModels() {
    const rows = await db
        .select()
        .from(trainingJobs)
        .where(eq(trainingJobs.status, "succeeded"))
        .orderBy(desc(trainingJobs.createdAt));
    return rows
        .filter((r) => r.fineTunedModel)
        .map((r) => {
        let id = r.fineTunedModel;
        let providerLabel = "Your Fine-Tunes (OpenAI)";
        let contextLength = 128000;
        if (r.provider === "together") {
            id = `${TOGETHER_PREFIX}${r.fineTunedModel}`;
            providerLabel = "Your Fine-Tunes (Together)";
            contextLength = 32768;
        }
        else if (r.provider === "mistral") {
            id = `${MISTRAL_PREFIX}${r.fineTunedModel}`;
            providerLabel = "Your Fine-Tunes (Mistral)";
            contextLength = 32768;
        }
        return {
            id,
            name: `${r.name} (fine-tuned)`,
            provider: providerLabel,
            description: `Your custom model, fine-tuned from ${r.baseModel}.`,
            contextLength,
        };
    });
}
