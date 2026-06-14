"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { EnvironmentOverview } from "@/lib/agents/environment/overview";
import type { MentorResponse } from "@/lib/agents/mentor";

export type CommandAck =
  | {
      ok: true;
      result: { exitCode: number; stdout: string; stderr: string };
      overview: EnvironmentOverview | null;
      flagsFound: number;
      totalFlags: number;
    }
  | { ok: false; error: string; message?: string };

export type ChatAck =
  | { ok: true; response: MentorResponse }
  | { ok: false; error: string };

type JoinAck = { ok: true; sessionId: number } | { ok: false; error: string };

export type SessionEventPayload = {
  id: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

export type EventHandler = (data: unknown) => void;

const MAX_RETRIES = 5;

export function useTrainingSocket(sessionId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const onEvent = useCallback((event: string, fn: EventHandler) => {
    const map = handlersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event)!.add(fn);
    socketRef.current?.on(event, fn);
    return () => {
      map.get(event)?.delete(fn);
      socketRef.current?.off(event, fn);
    };
  }, []);

  const offEvent = useCallback((event: string, fn: EventHandler) => {
    handlersRef.current.get(event)?.delete(fn);
    socketRef.current?.off(event, fn);
  }, []);

  useEffect(() => {
    if (sessionId === null) return;

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: MAX_RETRIES,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    const reattach = () => {
      for (const [event, set] of handlersRef.current) {
        for (const fn of set) {
          socket.on(event, fn);
        }
      }
    };

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      reattach();
      socket.emit("join_session", { sessionId }, (ack: JoinAck) => {
        if (!ack?.ok) {
          console.warn("[socket] join_session failed", ack);
        }
      });
    });

    socket.io.on("reconnect_attempt", (n: number) => {
      setReconnectAttempt(n);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [sessionId]);

  const emitCommand = useCallback(
    (command: string): Promise<CommandAck> => {
      const sk = socketRef.current;
      if (!sk || !sessionId) {
        return Promise.resolve({ ok: false, error: "no_socket" });
      }
      return new Promise((resolve) => {
        const timeout = window.setTimeout(() => {
          resolve({ ok: false, error: "timeout" });
        }, 120_000);
        sk.emit("command", { sessionId, command }, (ack: CommandAck) => {
          window.clearTimeout(timeout);
          resolve(ack);
        });
      });
    },
    [sessionId],
  );

  const emitChat = useCallback(
    (message: string): Promise<ChatAck> => {
      const sk = socketRef.current;
      if (!sk || !sessionId) {
        return Promise.resolve({ ok: false, error: "no_socket" });
      }
      return new Promise((resolve) => {
        const timeout = window.setTimeout(() => {
          resolve({ ok: false, error: "timeout" });
        }, 120_000);
        sk.emit("chat_message", { sessionId, message }, (ack: ChatAck) => {
          window.clearTimeout(timeout);
          resolve(ack);
        });
      });
    },
    [sessionId],
  );

  return {
    isConnected,
    reconnectAttempt,
    emitCommand,
    emitChat,
    onEvent,
    offEvent,
  };
}
