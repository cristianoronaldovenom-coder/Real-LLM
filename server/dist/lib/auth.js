import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { db, appConfig } from "../db.js";
const APP_CONFIG_ROW_ID = 1;
const TOKEN_TTL = "60d";
let cachedSecret = null;
/**
 * Returns the persistent JWT signing secret, generating and storing one in the
 * database on first use. Keeping it in the DB means tokens stay valid across
 * server restarts and deploys without any manual configuration.
 */
export async function getJwtSecret() {
    if (cachedSecret)
        return cachedSecret;
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
    cachedSecret = final.jwtSecret;
    return cachedSecret;
}
export function hashPassword(password) {
    return bcrypt.hash(password, 10);
}
export function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function signToken(userId) {
    const secret = await getJwtSecret();
    return jwt.sign({ uid: userId }, secret, { expiresIn: TOKEN_TTL });
}
/** Shape returned to clients — never includes the password hash. */
export function publicUser(user) {
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
export async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        const secret = await getJwtSecret();
        const payload = jwt.verify(token, secret);
        if (!payload?.uid) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        req.userId = payload.uid;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
