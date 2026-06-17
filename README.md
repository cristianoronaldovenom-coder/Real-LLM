# LLM Studio

A self-hosted AI chat app powered by **OpenRouter** open-source models (Llama, Qwen, DeepSeek, Mistral, and more).

**Features:**
- 💬 Multi-conversation chat with streaming responses
- 🧠 Persistent memory — the AI learns facts about you over time
- 📚 Knowledge base (RAG) — upload documents, let the AI reference them
- 🎛️ Per-conversation model & system-prompt selection
- 🗂️ Browse 100+ open-source models from OpenRouter
- 🐳 One-command Docker deployment for local or datacenter use

---

## Quick Start (Local)

### Prerequisites
- Node.js 22+
- PostgreSQL 15+ running locally (or use Docker)

### 1. Clone & install
```bash
git clone <your-repo>
cd llm-studio
npm run setup          # installs deps for root, server, and client
```

### 2. Configure the server
```bash
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL to your PostgreSQL connection string
```

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Start development servers
```bash
npm run dev
# API server → http://localhost:3001
# Frontend   → http://localhost:5173
```

### 5. Add your OpenRouter API key

Open **http://localhost:5173**, go to **Settings**, and paste your key from [openrouter.ai/keys](https://openrouter.ai/keys).

Alternatively, set `OPENROUTER_API_KEY` in `server/.env` to pre-fill it.

---

## Docker Deployment (Local or Datacenter / VPS)

Everything runs with a single command — no separate PostgreSQL install needed.

### 1. (Optional) Set your API key in the env file
```bash
cp server/.env.example server/.env
# Uncomment and fill OPENROUTER_API_KEY=sk-or-v1-... in server/.env
```

### 2. Start the stack
```bash
npm run docker:up
# Starts PostgreSQL + the app server, runs migrations automatically
# App is available at http://localhost:3001
```

### Stop
```bash
npm run docker:down
```

### View logs
```bash
npm run docker:logs
```

### Expose on a VPS
Point a reverse proxy (nginx, Caddy) at port `3001`, or change the port:
```bash
PORT=80 npm run docker:up
```

---

## Project Structure

```
llm-studio/
├── server/                  # Express + TypeScript API
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── app.ts           # Express setup
│   │   ├── db.ts            # Drizzle ORM schema + connection
│   │   ├── migrate.ts       # DB migration script
│   │   ├── lib/
│   │   │   ├── openrouter.ts  # OpenRouter client & key management
│   │   │   ├── models.ts      # Model catalog
│   │   │   ├── memory.ts      # Auto-learning memory
│   │   │   └── rag.ts         # Document chunking & retrieval
│   │   └── routes/
│   │       ├── conversations.ts
│   │       ├── documents.ts
│   │       ├── memories.ts
│   │       ├── settings.ts
│   │       └── index.ts       # Health, models, stats
│   ├── .env.example
│   └── package.json
│
├── client/                  # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── KnowledgePage.tsx
│   │   │   ├── MemoryPage.tsx
│   │   │   ├── ModelsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── lib/utils.ts     # API client + shared types
│   │   ├── App.tsx          # Router + sidebar
│   │   └── main.tsx
│   └── package.json
│
├── docker-compose.yml       # Full stack (DB + server)
├── Dockerfile               # Multi-stage production build
├── docker-entrypoint.sh     # Runs migrations + starts server
└── package.json             # Root scripts
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | `production` disables dev logs |
| `OPENROUTER_API_KEY` | — | Optional pre-configured key |

---

## Production Build (without Docker)

```bash
npm run build             # Builds both client and server
npm run db:migrate        # Run migrations
npm start                 # Starts the production server on PORT
```

The Express server serves the built React frontend as static files, so you only need one process and one port.
