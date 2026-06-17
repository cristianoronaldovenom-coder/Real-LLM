import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, appConfig, type User } from "../db.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const APP_CONFIG_ROW_ID = 1;
const TOKEN_TTL = "60d";

let cachedSecret: string | null = null;

/**
 * Returns the persistent JWT signing secret, generating and storing one in the
 * database on first use. Keeping it in the DB means tokens stay valid across
 * server restarts and deploys without any manual configuration.
 */
export async function getJwtSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const [row] = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.id, APP_CONFIG_ROW_ID));

  if (row?.jwtSecret) {
    cachedSecret = row.jwtSecret;
    return cachedSecret;
  }

  // Ensure the config row exists, then claim the secret atomically: the
  // conditional UPDATE only writes when no secret is set yet, so concurrent
  // cold starts can't clobber each other — the first writer wins.
  const candidate = crypto.randomBytes(48).toString("hex");
  await db
    .insert(appConfig)
    .values({ id: APP_CONFIG_ROW_ID, jwtSecret: candidate })
    .onConflictDoNothing({ target: appConfig.id });
  await db
    .update(appConfig)
    .set({ jwtSecret: candidate })
    .where(and(eq(appConfig.id, APP_CONFIG_ROW_ID), isNull(appConfig.jwtSecret)));

  const [final] = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.id, APP_CONFIG_ROW_ID));
  cachedSecret = final!.jwtSecret!;
  return cachedSecret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(userId: number): Promise<string> {
  const secret = await getJwtSecret();
  return jwt.sign({ uid: userId }, secret, { expiresIn: TOKEN_TTL });
}

/** Shape returned to clients — never includes the password hash. */
export function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

/**
 * Express middleware: requires a valid Bearer token. Sets req.userId on success,
 * otherwise responds 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const secret = await getJwtSecret();
    const payload = jwt.verify(token, secret) as { uid?: number };
    if (!payload?.uid) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
