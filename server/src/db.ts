import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Schema ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appConfig = pgTable("app_config", {
  id: integer("id").primaryKey().default(1),
  jwtSecret: text("jwt_secret"),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("New Conversation"),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt"),
  useKnowledgeBase: boolean("use_knowledge_base").notNull().default(false),
  useWebSearch: boolean("use_web_search").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
});

export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  source: varchar("source", { length: 20 }).notNull().default("manual"), // 'manual' | 'auto'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  openrouterApiKey: text("openrouter_api_key"),
  openaiApiKey: text("openai_api_key"),
  tavilyApiKey: text("tavily_api_key"),
  togetherApiKey: text("together_api_key"),
  mistralApiKey: text("mistral_api_key"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trainingJobs = pgTable("training_jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: varchar("provider", { length: 20 }).notNull().default("openai"),
  baseModel: text("base_model").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("preparing"),
  source: varchar("source", { length: 20 }).notNull().default("examples"),
  exampleCount: integer("example_count").notNull().default(0),
  providerFileId: text("provider_file_id"),
  providerJobId: text("provider_job_id"),
  fineTunedModel: text("fine_tuned_model"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const SETTINGS_ROW_ID = 1;

// ─── Connection ─────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: { users, appConfig, conversations, messages, documents, documentChunks, memories, settings, trainingJobs },
});

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type TrainingJob = typeof trainingJobs.$inferSelect;
