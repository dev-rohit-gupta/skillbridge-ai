import type {NextFunction, Request, Response} from "express";
import {AppError} from "../lib/errors";
import {verifyAccessToken} from "../lib/jwt";
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "AUTH_REQUIRED", "Please sign in to continue.");
    const token = await verifyAccessToken(header.slice(7));
    req.auth = {userId: token.userId, tokenId: token.jti}; next();
  } catch (error) {next(error)}
}
