import { Router } from "express";
import { z } from "zod";
import { db, documentChunks, documents } from "../db.js";
import { desc, eq, sql } from "drizzle-orm";
import { chunkText } from "../lib/rag.js";

const router = Router();

const CreateDocumentBody = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  type: z.string().optional(),
});

function preview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 200);
}

router.get("/documents", async (_req, res) => {
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      type: documents.type,
      content: documents.content,
      createdAt: documents.createdAt,
      chunkCount: sql<number>`(select count(*)::int from document_chunks where document_id = ${documents.id})`,
    })
    .from(documents)
    .orderBy(desc(documents.createdAt));

  res.json(rows.map((r) => ({
    id: r.id, name: r.name, type: r.type,
    preview: preview(r.content), charCount: r.content.length,
    chunkCount: r.chunkCount, createdAt: r.createdAt,
  })));
});

router.post("/documents", async (req, res) => {
  const body = CreateDocumentBody.parse(req.body);
  const type = body.type?.trim() || "text";

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(documents).values({ name: body.name, type, content: body.content }).returning();
    const chunks = chunkText(inserted!.content);
    if (chunks.length > 0) {
      await tx.insert(documentChunks).values(chunks.map((chunk, index) => ({ documentId: inserted!.id, chunkIndex: index, content: chunk })));
    }
    return { doc: inserted!, chunkCount: chunks.length };
  });

  res.status(201).json({
    id: result.doc.id, name: result.doc.name, type: result.doc.type,
    preview: preview(result.doc.content), charCount: result.doc.content.length,
    chunkCount: result.chunkCount, createdAt: result.doc.createdAt,
  });
});

router.get("/documents/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(documentChunks).where(eq(documentChunks.documentId, doc.id));
  res.json({ id: doc.id, name: doc.name, type: doc.type, content: doc.content, charCount: doc.content.length, chunkCount: count, createdAt: doc.createdAt });
});

router.delete("/documents/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
  if (!deleted) { res.status(404).json({ error: "Document not found" }); return; }
  res.status(204).end();
});

export default router;
