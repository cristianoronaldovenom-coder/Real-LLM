import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  requireAuth,
} from "../lib/auth.js";

const router = Router();

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use only letters, numbers, and . _ -"),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
  displayName: z.string().trim().max(100).optional(),
});

// POST /api/auth/signup
router.post("/auth/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const { username, password, displayName } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "That username is already taken" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ username, passwordHash, displayName: displayName || null })
    .returning();

  const token = await signToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const parsed = z
    .object({ username: z.string().trim().min(1), password: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect username or password" });
    return;
  }

  const token = await signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Account no longer exists" });
    return;
  }
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/profile — update display name
router.patch("/auth/profile", requireAuth, async (req, res) => {
  const parsed = z
    .object({ displayName: z.string().trim().max(100) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid display name" });
    return;
  }
  const [user] = await db
    .update(users)
    .set({ displayName: parsed.data.displayName || null })
    .where(eq(users.id, req.userId!))
    .returning();
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/password — change password
router.patch("/auth/password", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, "New password must be at least 6 characters").max(200),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  res.json({ ok: true });
});

export default router;
