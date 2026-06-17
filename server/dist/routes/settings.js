import { Router } from "express";
import { z } from "zod";
import { db, settings, SETTINGS_ROW_ID } from "../db.js";
import { invalidateKeyCache, resolveApiKey } from "../lib/openrouter.js";
import { invalidateOpenAIKeyCache, resolveOpenAIKey } from "../lib/openai.js";
import { invalidateTavilyKeyCache, resolveTavilyKey } from "../lib/websearch.js";
import { invalidateTogetherKeyCache, resolveTogetherKey } from "../lib/together.js";
import { invalidateMistralKeyCache, resolveMistralKey } from "../lib/mistral.js";
const router = Router();
const UpdateSettingsBody = z.object({
    openrouterApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    tavilyApiKey: z.string().optional(),
    togetherApiKey: z.string().optional(),
    mistralApiKey: z.string().optional(),
});
function maskOpenRouter(key) {
    return `sk-or-…${key.slice(-4)}`;
}
function maskOpenAI(key) {
    return `sk-…${key.slice(-4)}`;
}
function maskTavily(key) {
    return `tvly-…${key.slice(-4)}`;
}
function maskGeneric(key) {
    return `…${key.slice(-4)}`;
}
async function buildStatus() {
    const or = await resolveApiKey();
    const oa = await resolveOpenAIKey();
    const tv = await resolveTavilyKey();
    const tg = await resolveTogetherKey();
    const ms = await resolveMistralKey();
    return {
        hasKey: Boolean(or.key),
        keyPreview: or.key ? maskOpenRouter(or.key) : null,
        source: or.source,
        openai: {
            hasKey: Boolean(oa.key),
            keyPreview: oa.key ? maskOpenAI(oa.key) : null,
            source: oa.source,
        },
        tavily: {
            hasKey: Boolean(tv.key),
            keyPreview: tv.key ? maskTavily(tv.key) : null,
            source: tv.source,
        },
        together: {
            hasKey: Boolean(tg.key),
            keyPreview: tg.key ? maskGeneric(tg.key) : null,
            source: tg.source,
        },
        mistral: {
            hasKey: Boolean(ms.key),
            keyPreview: ms.key ? maskGeneric(ms.key) : null,
            source: ms.source,
        },
    };
}
async function setOpenRouterKey(key) {
    await db
        .insert(settings)
        .values({ id: SETTINGS_ROW_ID, openrouterApiKey: key })
        .onConflictDoUpdate({ target: settings.id, set: { openrouterApiKey: key, updatedAt: new Date() } });
    invalidateKeyCache();
}
async function setOpenAIKey(key) {
    await db
        .insert(settings)
        .values({ id: SETTINGS_ROW_ID, openaiApiKey: key })
        .onConflictDoUpdate({ target: settings.id, set: { openaiApiKey: key, updatedAt: new Date() } });
    invalidateOpenAIKeyCache();
}
async function setTavilyKey(key) {
    await db
        .insert(settings)
        .values({ id: SETTINGS_ROW_ID, tavilyApiKey: key })
        .onConflictDoUpdate({ target: settings.id, set: { tavilyApiKey: key, updatedAt: new Date() } });
    invalidateTavilyKeyCache();
}
async function setTogetherKey(key) {
    await db
        .insert(settings)
        .values({ id: SETTINGS_ROW_ID, togetherApiKey: key })
        .onConflictDoUpdate({ target: settings.id, set: { togetherApiKey: key, updatedAt: new Date() } });
    invalidateTogetherKeyCache();
}
async function setMistralKey(key) {
    await db
        .insert(settings)
        .values({ id: SETTINGS_ROW_ID, mistralApiKey: key })
        .onConflictDoUpdate({ target: settings.id, set: { mistralApiKey: key, updatedAt: new Date() } });
    invalidateMistralKeyCache();
}
router.get("/settings", async (_req, res) => {
    res.json(await buildStatus());
});
router.put("/settings", async (req, res) => {
    const body = UpdateSettingsBody.parse(req.body);
    if (body.openrouterApiKey === undefined &&
        body.openaiApiKey === undefined &&
        body.tavilyApiKey === undefined &&
        body.togetherApiKey === undefined &&
        body.mistralApiKey === undefined) {
        res.status(400).json({ error: "Provide openrouterApiKey, openaiApiKey, tavilyApiKey, togetherApiKey, or mistralApiKey." });
        return;
    }
    if (body.openrouterApiKey !== undefined) {
        const key = body.openrouterApiKey.trim();
        if (!key) {
            res.status(400).json({ error: "API key cannot be empty" });
            return;
        }
        await setOpenRouterKey(key);
    }
    if (body.openaiApiKey !== undefined) {
        const key = body.openaiApiKey.trim();
        if (!key) {
            res.status(400).json({ error: "API key cannot be empty" });
            return;
        }
        await setOpenAIKey(key);
    }
    if (body.tavilyApiKey !== undefined) {
        const key = body.tavilyApiKey.trim();
        if (!key) {
            res.status(400).json({ error: "API key cannot be empty" });
            return;
        }
        await setTavilyKey(key);
    }
    if (body.togetherApiKey !== undefined) {
        const key = body.togetherApiKey.trim();
        if (!key) {
            res.status(400).json({ error: "API key cannot be empty" });
            return;
        }
        await setTogetherKey(key);
    }
    if (body.mistralApiKey !== undefined) {
        const key = body.mistralApiKey.trim();
        if (!key) {
            res.status(400).json({ error: "API key cannot be empty" });
            return;
        }
        await setMistralKey(key);
    }
    res.json(await buildStatus());
});
router.delete("/settings", async (req, res) => {
    const provider = String(req.query.provider ?? "openrouter");
    if (provider === "openai")
        await setOpenAIKey(null);
    else if (provider === "tavily")
        await setTavilyKey(null);
    else if (provider === "together")
        await setTogetherKey(null);
    else if (provider === "mistral")
        await setMistralKey(null);
    else
        await setOpenRouterKey(null);
    res.json(await buildStatus());
});
export default router;
