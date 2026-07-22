import type {NextFunction, Request, Response} from "express";
import {AppError} from "../lib/errors.js";
export const notFound = (req: Request, res: Response) => res.status(404).json({success: false, error: {code: "ROUTE_NOT_FOUND", message: `No route matches ${req.method} ${req.path}.`}});
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) return res.status(error.statusCode).json({success: false, error: {code: error.code, message: error.message, details: error.details}});
  console.error(error); return res.status(500).json({success: false, error: {code: "INTERNAL_SERVER_ERROR", message: "Something went wrong."}});
}
