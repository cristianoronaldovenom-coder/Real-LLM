import { db, settings, SETTINGS_ROW_ID } from "../db.js";
import { eq } from "drizzle-orm";
const CACHE_TTL_MS = 30_000;
let cache = null;
async function readUserKey() {
    const [row] = await db
        .select({ key: settings.tavilyApiKey })
        .from(settings)
        .where(eq(settings.id, SETTINGS_ROW_ID))
        .limit(1);
    const key = row?.key?.trim();
    return key ? key : null;
}
export function invalidateTavilyKeyCache() {
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
export async function resolveTavilyKey() {
    const userKey = await getUserKey();
    if (userKey)
        return { key: userKey, source: "user" };
    const envKey = process.env.TAVILY_API_KEY?.trim() || null;
    if (envKey)
        return { key: envKey, source: "env" };
    return { key: null, source: "none" };
}
/**
 * Run a live web search via Tavily. Returns null when no key is configured or
 * the request fails, so callers can degrade gracefully.
 */
export async function performWebSearch(query, maxResults = 5) {
    const trimmed = query.trim();
    if (!trimmed)
        return null;
    const { key } = await resolveTavilyKey();
    if (!key)
        return null;
    try {
        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: key,
                query: trimmed,
                search_depth: "basic",
                max_results: maxResults,
                include_answer: true,
            }),
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        const results = (data.results ?? []).map((r) => ({
            title: r.title?.trim() || "Untitled",
            url: r.url?.trim() || "",
            content: r.content?.trim() || "",
        }));
        return { answer: data.answer?.trim() || null, results };
    }
    catch {
        return null;
    }
}
export function buildWebSearchBlock(search) {
    const parts = [];
    if (search.answer)
        parts.push(`Quick answer: ${search.answer}`);
    search.results.forEach((r, i) => {
        parts.push(`[Result ${i + 1}: ${r.title}]\nURL: ${r.url}\n${r.content}`);
    });
    return parts.join("\n\n---\n\n");
}
