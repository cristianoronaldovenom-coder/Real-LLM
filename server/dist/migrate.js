/**
 * Run with: npm run db:migrate
 * Creates all tables if they don't exist.
 */
import pg from "pg";
import "dotenv/config";
const DDL = `
-- users (authentication)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- app_config (single-row; stores the persistent JWT signing secret)
CREATE TABLE IF NOT EXISTS app_config (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  jwt_secret TEXT
);
INSERT INTO app_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- conversations
CREATE TABLE IF NOT EXISTS conversations (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT 'New Conversation',
  model        TEXT NOT NULL,
  system_prompt TEXT,
  use_knowledge_base BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id               SERIAL PRIMARY KEY,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'text',
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- document_chunks (for full-text search / RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
  id           SERIAL PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);

-- memories
CREATE TABLE IF NOT EXISTS memories (
  id         SERIAL PRIMARY KEY,
  content    TEXT NOT NULL,
  source     VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- settings (single-row store)
CREATE TABLE IF NOT EXISTS settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  openrouter_api_key TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tavily_api_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS together_api_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS mistral_api_key TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS use_web_search BOOLEAN NOT NULL DEFAULT false;

-- training_jobs (OpenAI fine-tuning)
CREATE TABLE IF NOT EXISTS training_jobs (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  provider         VARCHAR(20) NOT NULL DEFAULT 'openai',
  base_model       TEXT NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'preparing',
  source           VARCHAR(20) NOT NULL DEFAULT 'examples',
  example_count    INTEGER NOT NULL DEFAULT 0,
  provider_file_id TEXT,
  provider_job_id  TEXT,
  fine_tuned_model TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
async function migrate() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log("Running migrations…");
        await pool.query(DDL);
        console.log("✅  Migrations complete.");
    }
    finally {
        await pool.end();
    }
}
migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
