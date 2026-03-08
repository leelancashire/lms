import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface SocketJwtPayload {
  sub: string;
  email?: string;
  type: "access" | "refresh";
}

let io: Server | null = null;

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const authToken = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
    const header = socket.handshake.headers.authorization;
    const bearer = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = authToken ?? bearer;

    if (!token) return next(new Error("Unauthorized: missing token"));

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as SocketJwtPayload;
      if (decoded.type !== "access") return next(new Error("Unauthorized: invalid token type"));

      socket.data.user = {
        id: decoded.sub,
        email: decoded.email,
      };

      return next();
    } catch {
      return next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinLeague", (leagueId: string) => {
      if (!leagueId) return;
      void socket.join(`league:${leagueId}`);
    });

    socket.on("leaveLeague", (leagueId: string) => {
      if (!leagueId) return;
      void socket.leave(`league:${leagueId}`);
    });

    socket.on("followGameweek", (gameweek: number) => {
      if (!Number.isInteger(gameweek) || gameweek < 1) return;
      void socket.join(`gameweek:${gameweek}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}
