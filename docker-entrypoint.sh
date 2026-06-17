#!/bin/sh
set -e

echo "Running database migrations…"
cd /app/server && node --input-type=module <<'EOF'
import "dotenv/config";
import pg from "pg";

const DDL = `
CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, title TEXT NOT NULL DEFAULT 'New Conversation', model TEXT NOT NULL, system_prompt TEXT, use_knowledge_base BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role VARCHAR(20) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'text', content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS document_chunks (id SERIAL PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, chunk_index INTEGER NOT NULL, content TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE TABLE IF NOT EXISTS memories (id SERIAL PRIMARY KEY, content TEXT NOT NULL, source VARCHAR(20) NOT NULL DEFAULT 'manual', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY DEFAULT 1, openrouter_api_key TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(DDL);
await pool.end();
console.log("✅ Migrations complete.");
EOF

echo "Starting server…"
exec node dist/index.js
