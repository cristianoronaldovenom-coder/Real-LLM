import OpenAI from "openai";
import { db, settings, SETTINGS_ROW_ID } from "../db.js";
import { eq } from "drizzle-orm";
const BASE_URL = "https://api.mistral.ai/v1";
const CACHE_TTL_MS = 30_000;
let cache = null;
async function readUserKey() {
    const [row] = await db
        .select({ key: settings.mistralApiKey })
        .from(settings)
        .where(eq(settings.id, SETTINGS_ROW_ID))
        .limit(1);
    const key = row?.key?.trim();
    return key ? key : null;
}
export function invalidateMistralKeyCache() {
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
export async function resolveMistralKey() {
    const userKey = await getUserKey();
    if (userKey)
        return { key: userKey, source: "user" };
    const envKey = process.env.MISTRAL_API_KEY?.trim() || null;
    if (envKey)
        return { key: envKey, source: "env" };
    return { key: null, source: "none" };
}
export class MissingMistralKeyError extends Error {
    constructor() {
        super("No Mistral AI API key is configured. Add your key on the Training or Settings page, or set the MISTRAL_API_KEY env variable.");
        this.name = "MissingMistralKeyError";
    }
}
async function getKeyOrThrow() {
    const { key } = await resolveMistralKey();
    if (!key)
        throw new MissingMistralKeyError();
    return key;
}
/**
 * Mistral fine-tuned models are routed through Mistral's OpenAI-compatible
 * chat endpoint. Their ids look like "ft:open-mistral-7b:…" — to keep routing
 * unambiguous we prefix the stored chat model id with "mistral:" and strip it
 * before calling the API.
 */
export const MISTRAL_PREFIX = "mistral:";
export function isMistralModel(model) {
    return model.startsWith(MISTRAL_PREFIX);
}
export function stripMistralPrefix(model) {
    return model.startsWith(MISTRAL_PREFIX) ? model.slice(MISTRAL_PREFIX.length) : model;
}
/** OpenAI-compatible client for chatting with Mistral-hosted models. */
export async function getMistralClient() {
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
    return `Mistral AI failed to ${action} (${res.status}): ${detail || res.statusText}`;
}
/** Maps Mistral's job statuses onto the app's normalized status vocabulary. */
function mapStatus(raw) {
    const v = String(raw ?? "").toUpperCase();
    if (v === "SUCCESS")
        return "succeeded";
    if (["FAILED", "FAILED_VALIDATION"].includes(v))
        return "failed";
    if (["CANCELLED", "CANCELED", "CANCELLATION_REQUESTED"].includes(v))
        return "cancelled";
    if (["QUEUED"].includes(v))
        return "queued";
    // RUNNING, STARTED, VALIDATING, VALIDATED, etc.
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
    const outputName = json.fine_tuned_model ?? null;
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
        throw new Error("Mistral AI did not return a file id for the upload.");
    return json.id;
}
export async function createFineTune(params) {
    const key = await getKeyOrThrow();
    const hyper = {};
    const hp = params.hyperparameters;
    if (hp?.trainingSteps != null)
        hyper.training_steps = hp.trainingSteps;
    if (hp?.learningRate != null)
        hyper.learning_rate = hp.learningRate;
    const body = {
        model: params.model,
        training_files: [{ file_id: params.trainingFileId }],
        auto_start: true,
    };
    if (Object.keys(hyper).length > 0)
        body.hyperparameters = hyper;
    const res = await fetch(`${BASE_URL}/fine_tuning/jobs`, {
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
    const res = await fetch(`${BASE_URL}/fine_tuning/jobs/${id}`, {
        headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok)
        throw new Error(await errorText(res, "check the fine-tune status"));
    return normalizeJob((await res.json()));
}
export async function cancelFineTune(id) {
    const key = await getKeyOrThrow();
    await fetch(`${BASE_URL}/fine_tuning/jobs/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
    });
}
