import type { Server as HttpServer } from "node:http";

import { getToken } from "next-auth/jwt";
import { Server, type Socket } from "socket.io";

import { createSessionEvent, getTrainingSessionForUser } from "@/db/queries";
import { environmentAgent, toOverview } from "@/lib/agents/environment";
import { loadState, saveState } from "@/lib/agents/environment/session-store";
import { mentorAgent } from "@/lib/agents/mentor";
import type { CommandResult } from "@/lib/agents/types";
import {
  decrementTrainingSocketConnections,
  incrementTrainingSocketConnections,
} from "@/lib/training-socket-stats";

const ROOM_PREFIX = "session:";

type AckFn = (payload: unknown) => void;

function sessionRoom(sessionId: number): string {
  return `${ROOM_PREFIX}${sessionId}`;
}

const commandWindows = new Map<string, number[]>();

function allowCommand(socketId: string): boolean {
  const now = Date.now();
  const prev = commandWindows.get(socketId) ?? [];
  const recent = prev.filter((t) => now - t < 5000);
  if (recent.length >= 10) {
    return false;
  }
  recent.push(now);
  commandWindows.set(socketId, recent);
  return true;
}

async function emitDbEvent(
  io: Server,
  sessionId: number,
  row: Awaited<ReturnType<typeof createSessionEvent>>,
): Promise<void> {
  if (!row) return;
  io.to(sessionRoom(sessionId)).emit("session_event", {
    id: row.id,
    eventType: row.eventType,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  });
}

export function attachTrainingSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookie = socket.request.headers.cookie ?? "";
      const token = await getToken({
        req: { headers: { cookie } } as Parameters<typeof getToken>[0]["req"],
        secret: process.env.AUTH_SECRET,
      });
      if (!token?.sub) {
        next(new Error("Unauthorized"));
        return;
      }
      const userId = Number.parseInt(String(token.sub), 10);
      if (!Number.isFinite(userId)) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    incrementTrainingSocketConnections();
    socket.on("disconnect", () => {
      decrementTrainingSocketConnections();
      commandWindows.delete(socket.id);
    });

    socket.on("join_session", async (payload: { sessionId: number }, ack?: AckFn) => {
      const userId = socket.data.userId as number;
      const sessionId = Number(payload?.sessionId);
      if (!Number.isFinite(sessionId)) {
        ack?.({ ok: false, error: "invalid_session" });
        return;
      }
      const owned = await getTrainingSessionForUser(sessionId, userId);
      if (!owned) {
        ack?.({ ok: false, error: "forbidden" });
        return;
      }
      await socket.join(sessionRoom(sessionId));
      socket.data.trainingSessionId = sessionId;
      ack?.({ ok: true, sessionId });
    });

    socket.on(
      "command",
      async (payload: { sessionId: number; command: string }, ack?: AckFn) => {
        const userId = socket.data.userId as number;
        const sessionId = Number(payload?.sessionId);
        const command = String(payload?.command ?? "");
        if (!Number.isFinite(sessionId) || !ack) {
          ack?.({ ok: false, error: "bad_request" });
          return;
        }
        if (!allowCommand(socket.id)) {
          ack({ ok: false, error: "rate_limited", message: "Max 10 commands per 5 seconds." });
          return;
        }

        const owned = await getTrainingSessionForUser(sessionId, userId);
        if (!owned) {
          ack({ ok: false, error: "forbidden" });
          return;
        }

        const trimmed = command.trim();
        const isFlagCmd = /^(flag|submit)\s+/i.test(trimmed);

        let result: CommandResult;
        try {
          result = await environmentAgent.executeCommand(sessionId, command);
        } catch (e) {
          ack({
            ok: false,
            error: "command_failed",
            message: e instanceof Error ? e.message : "Command failed",
          });
          return;
        }

        const state = loadState(sessionId);
        if (state) {
          saveState(sessionId, state);
        }

        if (!isFlagCmd) {
          const row = await createSessionEvent({
            sessionId,
            eventType: "milestone_reached",
            payload: {
              command,
              exitCode: result.exitCode,
              stdoutPreview: result.stdout.slice(0, 2000),
            },
          });
          await emitDbEvent(io, sessionId, row);
        }

        const overview = state ? toOverview(state.topology) : null;
        const flagsFound = state?.flags.filter((f) => f.found).length ?? 0;
        const totalFlags = state?.flags.length ?? 0;

        ack({
          ok: true,
          result,
          overview,
          flagsFound,
          totalFlags,
        });
      },
    );

    socket.on(
      "chat_message",
      async (payload: { sessionId: number; message: string }, ack?: AckFn) => {
        const userId = socket.data.userId as number;
        const sessionId = Number(payload?.sessionId);
        const message = String(payload?.message ?? "").trim();
        if (!Number.isFinite(sessionId) || !message || !ack) {
          ack?.({ ok: false, error: "bad_request" });
          return;
        }

        const owned = await getTrainingSessionForUser(sessionId, userId);
        if (!owned) {
          ack({ ok: false, error: "forbidden" });
          return;
        }

        try {
          const response = await mentorAgent.chat(sessionId, userId, message);
          io.to(sessionRoom(sessionId)).emit("mentor_broadcast", {
            sessionId,
            response,
          });
          ack({ ok: true, response });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Chat failed";
          ack({ ok: false, error: msg });
        }
      },
    );
  });

  return io;
}
