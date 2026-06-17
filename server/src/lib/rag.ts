import { db, documentChunks, documents } from "../db.js";
import { eq, sql } from "drizzle-orm";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastBreak > CHUNK_SIZE * 0.5) end = start + lastBreak + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

export interface RetrievedChunk {
  documentId: number;
  documentName: string;
  content: string;
}

export async function retrieveRelevantChunks(query: string, limit = 6): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const rows = await db
      .select({
        documentId: documentChunks.documentId,
        documentName: documents.name,
        content: documentChunks.content,
        rank: sql<number>`ts_rank(to_tsvector('english', ${documentChunks.content}), plainto_tsquery('english', ${trimmed}))`,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(sql`to_tsvector('english', ${documentChunks.content}) @@ plainto_tsquery('english', ${trimmed})`)
      .orderBy(sql`ts_rank(to_tsvector('english', ${documentChunks.content}), plainto_tsquery('english', ${trimmed})) DESC`)
      .limit(limit);

    return rows.map((r) => ({ documentId: r.documentId, documentName: r.documentName, content: r.content }));
  } catch {
    return [];
  }
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks.map((c, i) => `[Source ${i + 1}: ${c.documentName}]\n${c.content}`).join("\n\n---\n\n");
}
