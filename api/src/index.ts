import "express-async-errors";
import cors from "cors";
import express from "express";
import http from "http";
import authRoutes from "./routes/auth";
import fixtureRoutes from "./routes/fixtures";
import leagueRoutes from "./routes/leagues";
import picksRoutes from "./routes/picks";
import teamRoutes from "./routes/teams";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { startFixtureSyncJobs } from "./services/fixtureSync";
import { startLiveScoresService } from "./services/liveScores";
import { startNotificationCrons } from "./services/notifications";
import { startOddsSyncService } from "./services/oddsSync";
import { initSocketServer } from "./sockets";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "api",
    message: "LMS API is running",
    endpoints: [
      "/health",
      "/api/auth",
      "/api/teams",
      "/api/fixtures",
      "/api/fixtures/:gameweek/odds",
      "/api/leagues",
      "/api/leagues/:leagueId/picks",
    ],
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/fixtures", fixtureRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/leagues/:leagueId/picks", picksRoutes);
app.use(errorHandler);

const server = http.createServer(app);
initSocketServer(server);

startFixtureSyncJobs();
startLiveScoresService();
startOddsSyncService();
startNotificationCrons();

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
