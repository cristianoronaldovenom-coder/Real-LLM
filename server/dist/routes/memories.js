import { Router } from "express";
import { z } from "zod";
import { db, memories } from "../db.js";
import { desc, eq } from "drizzle-orm";
import { MAX_MEMORY_LENGTH } from "../lib/memory.js";
const router = Router();
const CreateMemoryBody = z.object({ content: z.string().min(1) });
const DeleteMemoryParams = z.object({ id: z.coerce.number() });
router.get("/memories", async (_req, res) => {
    const rows = await db.select().from(memories).orderBy(desc(memories.createdAt));
    res.json(rows);
});
router.post("/memories", async (req, res) => {
    const body = CreateMemoryBody.parse(req.body);
    const content = body.content.trim();
    if (!content) {
        res.status(400).json({ error: "Memory content cannot be empty" });
        return;
    }
    if (content.length > MAX_MEMORY_LENGTH) {
        res.status(400).json({ error: `Memory is too long. Keep it under ${MAX_MEMORY_LENGTH} characters.` });
        return;
    }
    const [created] = await db.insert(memories).values({ content, source: "manual" }).returning();
    res.status(201).json(created);
});
router.delete("/memories", async (_req, res) => {
    await db.delete(memories);
    res.status(204).end();
});
router.delete("/memories/:id", async (req, res) => {
    const { id } = DeleteMemoryParams.parse(req.params);
    const [deleted] = await db.delete(memories).where(eq(memories.id, id)).returning({ id: memories.id });
    if (!deleted) {
        res.status(404).json({ error: "Memory not found" });
        return;
    }
    res.status(204).end();
});
export default router;
