import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error";
import { analysisRouter, roadmapRouter } from "./modules/analyses";
import { authRouter, profileRouter } from "./modules/auth";
import { dashboardRouter } from "./modules/dashboard";
import { referenceRouter } from "./modules/reference";
import { jobDescriptionRouter } from "./modules/job-descriptions";
import { resumeRouter } from "./modules/resumes";


const app = express();


app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(
  pinoHttp({
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
    ],

    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          remoteAddress: request.remoteAddress,
        };
      },

      res(response) {
        return {
          statusCode: response.statusCode,
        };
      },

      err(error) {
        return {
          type: error.name,
          message: error.message,
          stack:
            env.NODE_ENV === "development"
              ? error.stack
              : undefined,
        };
      },
    },

    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) {
        return "error";
      }

      if (res.statusCode >= 400) {
        return "warn";
      }

      return "info";
    },

    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} completed with ${res.statusCode}`;
    },

    customErrorMessage(req, res) {
      return `${req.method} ${req.url} failed with ${res.statusCode}`;
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());



app.get("/api/v1/health", (_req, res) =>
  res.json({ success: true, data: { status: "ok" } }),
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1", referenceRouter);
app.use("/api/v1/resumes", resumeRouter);
app.use("/api/v1/job-descriptions", jobDescriptionRouter);
app.use("/api/v1/analyses", analysisRouter);
app.use("/api/v1", roadmapRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use(notFound);
app.use(errorHandler);


// exporting the app instance 
export default app;
