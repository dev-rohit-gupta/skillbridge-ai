import {eq} from "drizzle-orm";
import {Router, type Response} from "express";
import {refreshTokens, userProfiles, users} from "@skillbridge/database";
import {loginInputSchema, registerInputSchema, updateProfileInputSchema} from "@skillbridge/shared";
import {db} from "../config/database";
import {env} from "../config/env";
import {AppError} from "../lib/errors";
import {createTokenPair, hashToken, verifyRefreshToken} from "../lib/jwt";
import {hashPassword, verifyPassword} from "../lib/password";
import {authenticate} from "../middleware/auth";
import {validateBody} from "../middleware/validate";

const ok = <T>(res: Response, data: T, status = 200) => res.status(status).json({success: true, data});
const cookieName = "sb_refresh_token";
const cookieOptions = {httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/v1/auth", maxAge: env.REFRESH_TOKEN_DAYS * 86400000};
const safeUser = (user: typeof users.$inferSelect) => ({id: user.id, fullName: user.fullName, email: user.email, onboardingCompleted: user.onboardingCompleted});
async function persistRefresh(userId: string, pair: Awaited<ReturnType<typeof createTokenPair>>) {
  await db.insert(refreshTokens).values({userId, jti: pair.refreshJti, tokenHash: hashToken(pair.refreshToken), expiresAt: pair.refreshExpiresAt});
}

export const authRouter = Router();
authRouter.post("/register", validateBody(registerInputSchema), async (req, res, next) => {
  try {
    const input = registerInputSchema.parse(req.body);
    const [existing] = await db.select({id: users.id}).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({fullName: input.fullName, email: input.email, passwordHash: await hashPassword(input.password)}).returning();
      if (!created) throw new Error("User creation failed");
      await tx.insert(userProfiles).values({userId: created.id}); return created;
    });
    const pair = await createTokenPair(user.id); await persistRefresh(user.id, pair); res.cookie(cookieName, pair.refreshToken, cookieOptions);
    return ok(res, {accessToken: pair.accessToken, user: safeUser(user)}, 201);
  } catch (error) {next(error)}
});
authRouter.post("/login", validateBody(loginInputSchema), async (req, res, next) => {
  try {
    const input = loginInputSchema.parse(req.body); const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Incorrect email or password.");
    const pair = await createTokenPair(user.id); await persistRefresh(user.id, pair); res.cookie(cookieName, pair.refreshToken, cookieOptions);
    return ok(res, {accessToken: pair.accessToken, user: safeUser(user)});
  } catch (error) {next(error)}
});
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const raw = req.cookies[cookieName] as string | undefined; if (!raw) throw new AppError(401, "AUTH_REFRESH_TOKEN_MISSING", "Your session has expired.");
    const verified = await verifyRefreshToken(raw); const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.jti, verified.jti)).limit(1);
    if (!stored || stored.revokedAt || stored.tokenHash !== hashToken(raw) || stored.expiresAt <= new Date()) throw new AppError(401, "AUTH_REFRESH_TOKEN_REVOKED", "Your session has expired.");
    const pair = await createTokenPair(verified.userId);
    await db.transaction(async (tx) => {
      await tx.update(refreshTokens).set({revokedAt: new Date(), replacedByJti: pair.refreshJti, updatedAt: new Date()}).where(eq(refreshTokens.id, stored.id));
      await tx.insert(refreshTokens).values({userId: verified.userId, jti: pair.refreshJti, tokenHash: hashToken(pair.refreshToken), expiresAt: pair.refreshExpiresAt});
    });
    res.cookie(cookieName, pair.refreshToken, cookieOptions); return ok(res, {accessToken: pair.accessToken});
  } catch (error) {next(error)}
});
authRouter.post("/logout", async (req, res, next) => {
  try {
    const raw = req.cookies[cookieName] as string | undefined;
    if (raw) try {const verified = await verifyRefreshToken(raw); await db.update(refreshTokens).set({revokedAt: new Date(), updatedAt: new Date()}).where(eq(refreshTokens.jti, verified.jti))} catch {}
    res.clearCookie(cookieName, {httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth"}); return ok(res, {loggedOut: true});
  } catch (error) {next(error)}
});
authRouter.get("/me", authenticate, async (req, res, next) => {
  try {const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1); if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found."); return ok(res, {user: safeUser(user)})} catch (error) {next(error)}
});

export const profileRouter = Router(); profileRouter.use(authenticate);
profileRouter.get("/", async (req, res, next) => {try {const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, req.auth!.userId)).limit(1); if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found."); return ok(res, profile)} catch (error) {next(error)}});
profileRouter.patch("/", validateBody(updateProfileInputSchema), async (req, res, next) => {try {const input = updateProfileInputSchema.parse(req.body); const [profile] = await db.update(userProfiles).set({...input, updatedAt: new Date()}).where(eq(userProfiles.userId, req.auth!.userId)).returning(); if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found."); return ok(res, profile)} catch (error) {next(error)}});
profileRouter.post("/complete-onboarding", async (req, res, next) => {try {const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, req.auth!.userId)).limit(1); if (!profile?.collegeName || !profile.degree || !profile.graduationYear || !profile.primaryRoleId) throw new AppError(409, "ONBOARDING_INCOMPLETE", "Complete all required fields."); const [user] = await db.update(users).set({onboardingCompleted: true, updatedAt: new Date()}).where(eq(users.id, req.auth!.userId)).returning(); return ok(res, {user: user ? safeUser(user) : null})} catch (error) {next(error)}});
