import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import systemRouter from "./routes/index.js";
import conversationsRouter from "./routes/conversations.js";
import documentsRouter from "./routes/documents.js";
import memoriesRouter from "./routes/memories.js";
import settingsRouter from "./routes/settings.js";
import trainingRouter from "./routes/training.js";
import authRouter from "./routes/auth.js";
import { requireAuth } from "./lib/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Public health check (used by deployment health probes)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public authentication routes (signup / login)
app.use("/api", authRouter);

// Everything below requires a valid login token
app.use("/api", requireAuth);
app.use("/api", systemRouter);
app.use("/api", conversationsRouter);
app.use("/api", documentsRouter);
app.use("/api", memoriesRouter);
app.use("/api", settingsRouter);
app.use("/api", trainingRouter);

// Serve built frontend in production
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get(/(.*)/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

export default app;
