import {createHash, randomUUID} from "node:crypto";
import {jwtVerify, SignJWT} from "jose";
import {env} from "../config/env.js";
import {AppError} from "./errors.js";
const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.ACCESS_TOKEN_SECRET);
const refreshSecret = encoder.encode(env.REFRESH_TOKEN_SECRET);
const issuer = "skillbridge-api"; const audience = "skillbridge-web";
async function sign(userId: string, type: "access"|"refresh", jti: string, expiration: string, secret: Uint8Array) {
  return new SignJWT({type}).setProtectedHeader({alg: "HS256", typ: "JWT"}).setSubject(userId).setJti(jti).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiration).sign(secret);
}
export async function createTokenPair(userId: string) {
  const accessJti = randomUUID(); const refreshJti = randomUUID();
  return {
    accessToken: await sign(userId, "access", accessJti, `${env.ACCESS_TOKEN_MINUTES}m`, accessSecret),
    refreshToken: await sign(userId, "refresh", refreshJti, `${env.REFRESH_TOKEN_DAYS}d`, refreshSecret),
    accessJti, refreshJti,
    refreshExpiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000),
  };
}
async function verify(token: string, expected: "access"|"refresh", secret: Uint8Array) {
  try {
    const {payload} = await jwtVerify(token, secret, {algorithms: ["HS256"], issuer, audience});
    if (payload.type !== expected || !payload.sub || !payload.jti || !payload.exp) throw new Error("Invalid claims");
    return {userId: payload.sub, jti: payload.jti, expiresAt: new Date(payload.exp * 1000)};
  } catch {throw new AppError(401, expected === "access" ? "AUTH_ACCESS_TOKEN_INVALID" : "AUTH_REFRESH_TOKEN_INVALID", "Your authentication token is invalid or expired.")}
}
export const verifyAccessToken = (token: string) => verify(token, "access", accessSecret);
export const verifyRefreshToken = (token: string) => verify(token, "refresh", refreshSecret);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
