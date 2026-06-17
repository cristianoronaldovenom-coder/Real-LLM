import OpenAI from "openai";
import { db, settings, SETTINGS_ROW_ID } from "../db.js";
import { eq } from "drizzle-orm";
const BASE_URL = "https://api.together.xyz/v1";
const CACHE_TTL_MS = 30_000;
let cache = null;
async function readUserKey() {
    const [row] = await db
        .select({ key: settings.togetherApiKey })
        .from(settings)
        .where(eq(settings.id, SETTINGS_ROW_ID))
        .limit(1);
    const key = row?.key?.trim();
    return key ? key : null;
}
export function invalidateTogetherKeyCache() {
    cache = null;
}
async function getUserKey() {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS)
        return cache.key;
    const key = await readUserKey();
    cache = { key, fetchedAt: now };
    return key;
}
export async function resolveTogetherKey() {
    const userKey = await getUserKey();
    if (userKey)
        return { key: userKey, source: "user" };
    const envKey = process.env.TOGETHER_API_KEY?.trim() || null;
    if (envKey)
        return { key: envKey, source: "env" };
    return { key: null, source: "none" };
}
export class MissingTogetherKeyError extends Error {
    constructor() {
        super("No Together AI API key is configured. Add your key on the Training or Settings page, or set the TOGETHER_API_KEY env variable.");
        this.name = "MissingTogetherKeyError";
    }
}
async function getKeyOrThrow() {
    const { key } = await resolveTogetherKey();
    if (!key)
        throw new MissingTogetherKeyError();
    return key;
}
/**
 * Together AI fine-tuned models are routed through an OpenAI-compatible
 * endpoint, but their names contain "/" (e.g. "you/Llama-3.1-8B-...") which
 * collides with OpenRouter ids. We prefix the chat model id with "together:"
 * so routing is unambiguous, and strip it before hitting the API.
 */
export const TOGETHER_PREFIX = "together:";
export function isTogetherModel(model) {
    return model.startsWith(TOGETHER_PREFIX);
}
export function stripTogetherPrefix(model) {
    return model.startsWith(TOGETHER_PREFIX) ? model.slice(TOGETHER_PREFIX.length) : model;
}
/** OpenAI-compatible client for chatting with Together-hosted models. */
export async function getTogetherClient() {
    const key = await getKeyOrThrow();
    return new OpenAI({ apiKey: key, baseURL: BASE_URL });
}
async function errorText(res, action) {
    let detail = "";
    try {
        const data = (await res.json());
        if (typeof data?.error === "string")
            detail = data.error;
        else
            detail = data?.error?.message || data?.message || JSON.stringify(data);
    }
    catch {
        detail = await res.text().catch(() => "");
    }
    return `Together AI failed to ${action} (${res.status}): ${detail || res.statusText}`;
}
/** Maps Together's job statuses onto the app's normalized status vocabulary. */
function mapStatus(raw) {
    const v = String(raw ?? "").toLowerCase();
    if (v === "completed")
        return "succeeded";
    if (["error", "failed", "user_error"].includes(v))
        return "failed";
    if (["cancelled", "canceled", "cancel_requested"].includes(v))
        return "cancelled";
    if (["pending", "queued"].includes(v))
        return "queued";
    // running, compressing, uploading, etc.
    return "running";
}
function extractError(json) {
    const err = json.error;
    if (typeof err === "string")
        return err;
    if (err && typeof err === "object" && "message" in err) {
        return String(err.message ?? "") || null;
    }
    return null;
}
function normalizeJob(json) {
    const outputName = json.output_name ??
        json.model_output_name ??
        null;
    return {
        id: String(json.id),
        status: mapStatus(json.status),
        outputName: outputName || null,
        error: extractError(json),
    };
}
/** Uploads a JSONL training file (conversational format) and returns its file id. */
export async function uploadTrainingFile(jsonl) {
    const key = await getKeyOrThrow();
    const form = new FormData();
    form.append("purpose", "fine-tune");
    form.append("file", new Blob([jsonl], { type: "application/jsonl" }), `training-${Date.now()}.jsonl`);
    const res = await fetch(`${BASE_URL}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
    });
    if (!res.ok)
        throw new Error(await errorText(res, "upload the training file"));
    const json = (await res.json());
    if (!json.id)
        throw new Error("Together AI did not return a file id for the upload.");
    return json.id;
}
export async function createFineTune(params) {
    const key = await getKeyOrThrow();
    const body = {
        training_file: params.trainingFileId,
        model: params.model,
        lora: true,
    };
    if (params.suffix)
        body.suffix = params.suffix;
    const hp = params.hyperparameters;
    if (hp?.nEpochs != null)
        body.n_epochs = hp.nEpochs;
    if (hp?.batchSize != null)
        body.batch_size = hp.batchSize;
    if (hp?.learningRate != null)
        body.learning_rate = hp.learningRate;
    if (hp?.loraR != null)
        body.lora_r = hp.loraR;
    if (hp?.loraAlpha != null)
        body.lora_alpha = hp.loraAlpha;
    const res = await fetch(`${BASE_URL}/fine-tunes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await errorText(res, "start the fine-tune"));
    return normalizeJob((await res.json()));
}
export async function retrieveFineTune(id) {
    const key = await getKeyOrThrow();
    const res = await fetch(`${BASE_URL}/fine-tunes/${id}`, {
        headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok)
        throw new Error(await errorText(res, "check the fine-tune status"));
    return normalizeJob((await res.json()));
}
export async function cancelFineTune(id) {
    const key = await getKeyOrThrow();
    await fetch(`${BASE_URL}/fine-tunes/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
    });
}
