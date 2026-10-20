import express from "express";
import { createServer, getServerPort } from "@devvit/web/server";

import { router as apiRoutes } from "./routes/api";
import { router as internalRoutes } from "./routes/internal";

/**
 * The server's front door, and nothing else.
 *
 * `/api/*` is what the webview calls. `/internal/*` is Devvit's own entry
 * points — the menu row, the forms behind it, triggers and scheduled tasks —
 * addressed by name from `devvit.json`.
 *
 * Keep each route module under ~2,000 lines; split by feature, not by halves.
 */
const app = express();
app.use(express.json());

app.use(apiRoutes);
app.use(internalRoutes);

createServer(app).listen(getServerPort());
