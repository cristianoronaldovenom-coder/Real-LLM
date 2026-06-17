import { Router } from "express";
import { getModels } from "../lib/models.js";
import { getFineTunedModels, syncActiveTrainingJobs } from "../lib/finetune.js";
import { db, conversations, messages, documents, memories } from "../db.js";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/models", async (_req, res) => {
  await syncActiveTrainingJobs();
  const [models, fineTuned] = await Promise.all([getModels(), getFineTunedModels()]);
  res.json([...fineTuned, ...models]);
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/stats", async (_req, res) => {
  const [convCount] = await db.select({ count: sql<number>`count(*)::int` }).from(conversations);
  const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messages);
  const [docCount] = await db.select({ count: sql<number>`count(*)::int` }).from(documents);
  const [memCount] = await db.select({ count: sql<number>`count(*)::int` }).from(memories);
  res.json({
    conversations: convCount?.count ?? 0,
    messages: msgCount?.count ?? 0,
    documents: docCount?.count ?? 0,
    memories: memCount?.count ?? 0,
  });
});

export default router;
