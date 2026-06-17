import { db, memories } from "../db.js";
import { desc } from "drizzle-orm";
import { getOpenRouterClient } from "./openrouter.js";
const MEMORY_MODEL = "meta-llama/llama-3.1-8b-instruct";
const MAX_MEMORIES_IN_PROMPT = 200;
const MEMORY_PROMPT_CHAR_BUDGET = 6000;
const LEARN_TIMEOUT_MS = 20000;
export const MAX_MEMORY_LENGTH = 500;
export async function getAllMemories() {
    const rows = await db
        .select({ content: memories.content })
        .from(memories)
        .orderBy(desc(memories.createdAt))
        .limit(MAX_MEMORIES_IN_PROMPT);
    return rows.map((r) => r.content);
}
export function buildMemoryBlock(items) {
    if (items.length === 0)
        return "";
    const selected = [];
    let used = 0;
    for (const item of items) {
        const line = `- ${item}`;
        if (used + line.length > MEMORY_PROMPT_CHAR_BUDGET && selected.length > 0)
            break;
        selected.push(line);
        used += line.length + 1;
    }
    return ("Here is what you already know about the user from previous conversations. " +
        "Treat these as established facts and use them to personalise your answers without restating them unprompted:\n\n" +
        selected.join("\n"));
}
function extractJsonArray(text) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start)
        return [];
    try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0 && x.length <= 300);
    }
    catch {
        return [];
    }
}
export async function learnFromExchange(userText, assistantText) {
    try {
        const allRows = await db.select({ content: memories.content }).from(memories);
        const existingContents = allRows.map((r) => r.content);
        const existingBlock = existingContents.length > 0
            ? existingContents.slice(0, MAX_MEMORIES_IN_PROMPT).map((m) => `- ${m}`).join("\n")
            : "(none yet)";
        const client = await getOpenRouterClient();
        const completion = await client.chat.completions.create({
            model: MEMORY_MODEL,
            max_tokens: 500,
            messages: [
                {
                    role: "system",
                    content: "You maintain a long-term memory of durable facts about a user. " +
                        "From the conversation snippet, extract stable, long-term facts worth remembering about the USER: " +
                        "their name, preferences, goals, projects, profession, location, constraints, and personal details. " +
                        "Ignore one-off questions, transient context, and general knowledge. " +
                        "Do NOT repeat facts already in the existing memory list. " +
                        'Respond ONLY with a JSON array of short factual strings (e.g. ["The user is named Alex"]). ' +
                        "If there is nothing new worth remembering, respond with [].",
                },
                {
                    role: "user",
                    content: `Existing memory:\n${existingBlock}\n\n` +
                        `New exchange:\nUser: ${userText}\nAssistant: ${assistantText}\n\n` +
                        "Return only the JSON array of NEW durable facts about the user.",
                },
            ],
        }, { signal: AbortSignal.timeout(LEARN_TIMEOUT_MS) });
        const raw = completion.choices[0]?.message?.content ?? "";
        const facts = extractJsonArray(raw);
        if (facts.length === 0)
            return;
        const existingLower = new Set(existingContents.map((m) => m.toLowerCase()));
        const fresh = facts
            .map((f) => f.slice(0, MAX_MEMORY_LENGTH))
            .filter((f) => !existingLower.has(f.toLowerCase()));
        if (fresh.length === 0)
            return;
        await db.insert(memories).values(fresh.map((content) => ({ content, source: "auto" })));
        console.log(`Learned ${fresh.length} new memories`);
    }
    catch (err) {
        console.error("Failed to learn memories:", err);
    }
}
