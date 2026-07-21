import type {NextFunction, Request, Response} from "express";
import type {ZodType} from "zod";
import {AppError} from "../lib/errors";
export const validateBody = (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(new AppError(422, "VALIDATION_ERROR", "The request contains invalid data.", result.error.flatten()));
  req.body = result.data; next();
};
