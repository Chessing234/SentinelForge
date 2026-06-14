import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";

import next from "next";

import { postgresClient } from "./src/db";
import { checkEnv } from "./src/lib/env-check";
import { startSlackScheduler } from "./src/lib/slack/scheduler";
import { attachTrainingSocketServer } from "./src/lib/websocket/server";

checkEnv();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url ?? "", true);
      void handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request error", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = attachTrainingSocketServer(httpServer);

  httpServer.once("error", (err) => {
    console.error(err);
    process.exit(1);
  });

  httpServer.listen(port, hostname, () => {
    console.info(`> Ready on http://${hostname}:${port} (Next.js + Socket.IO)`);
    startSlackScheduler();
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`> Received ${signal}, shutting down gracefully...`);

    // Force-exit if graceful shutdown stalls (e.g. lingering connections).
    const forceTimer = setTimeout(() => {
      console.error("> Graceful shutdown timed out, forcing exit.");
      process.exit(1);
    }, 15_000);
    forceTimer.unref();

    void (async () => {
      try {
        await new Promise<void>((resolve) => io.close(() => resolve()));
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
        const maybeClose = (app as { close?: () => Promise<void> }).close;
        if (typeof maybeClose === "function") {
          await maybeClose.call(app);
        }
        await postgresClient.end({ timeout: 5 });
        clearTimeout(forceTimer);
        console.info("> Shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("> Error during shutdown", err);
        process.exit(1);
      }
    })();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
