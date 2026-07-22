import {
  routes,
  type VercelConfig,
} from "@vercel/config/v1";
import { env } from "./src/config/env";

const rawBackendUrl = env.BACKEND_URL;

if (!rawBackendUrl) {
  throw new Error(
    "BACKEND_URL environment variable is required.",
  );
}

// Remove trailing slashes from the backend URL
const backendUrl = rawBackendUrl.replace(/\/+$/, "");

export const config: VercelConfig = {
  rewrites: [
    routes.rewrite(
      "/api/:path*",
      `${backendUrl}/api/:path*`,
    ),

    routes.rewrite(
      "/(.*)",
      "/index.html",
    ),
  ],
};