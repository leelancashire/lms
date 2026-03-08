import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { syncOddsForGameweek } from "../services/oddsSync";
import { processGameweekResults } from "../services/resultProcessor";
import { getCurrentGameweekInfo, getGameweekDeadline, getNextOpenGameweekInfo } from "../utils/gameweek";

const router = Router();
const gameweekParamSchema = z.object({
  gameweek: z.coerce.number().int().positive(),
});

function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const admins = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}

router.get("/", async (req, res) => {
  const gameweekParam = req.query.gameweek;
  const gameweek = Number(gameweekParam);

  if (!gameweekParam || Number.isNaN(gameweek) || gameweek < 1) {
    return res.status(400).json({ error: "Query parameter 'gameweek' must be a positive number" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: { gameweek },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: { kickoffTime: "asc" },
  });

  const deadline = await getGameweekDeadline(gameweek);

  return res.json({ fixtures, deadline });
});

router.get("/current-gameweek", async (_req, res) => {
  const info = await getCurrentGameweekInfo();

  if (!info) {
    return res.status(404).json({ error: "No fixtures available" });
  }

  return res.json(info);
});

router.get("/next-open-gameweek", async (_req, res) => {
  const info = await getNextOpenGameweekInfo();

  if (!info) {
    return res.status(404).json({ error: "No open gameweek available" });
  }

  return res.json(info);
});

router.get("/history", async (req, res) => {
  const fromRaw = req.query.from;
  const toRaw = req.query.to;

  const current = await getCurrentGameweekInfo();
  if (!current) return res.status(404).json({ error: "No fixtures available" });

  const from = fromRaw == null ? 1 : Number(fromRaw);
  const to = toRaw == null ? current.gameweek : Number(toRaw);

  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < 1 || from > to) {
    return res.status(400).json({ error: "Invalid range. Use positive integers with from <= to." });
  }

  const fixtures = await prisma.fixture.findMany({
    where: {
      gameweek: {
        gte: from,
        lte: to,
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: [{ gameweek: "asc" }, { kickoffTime: "asc" }],
  });

  const grouped = new Map<number, typeof fixtures>();
  for (const fixture of fixtures) {
    const arr = grouped.get(fixture.gameweek) ?? [];
    arr.push(fixture);
    grouped.set(fixture.gameweek, arr);
  }

  const gameweeks = Array.from(grouped.entries()).map(([gameweek, gwFixtures]) => ({
    gameweek,
    fixtures: gwFixtures.sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()),
  }))
    .sort((a, b) => b.gameweek - a.gameweek);

  return res.json({
    from,
    to,
    currentGameweek: current.gameweek,
    gameweeks,
  });
});

router.get("/:fixtureId/events", async (req, res) => {
  const { fixtureId } = req.params;

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { id: true },
  });

  if (!fixture) {
    return res.status(404).json({ error: "Fixture not found" });
  }

  const events = await prisma.matchEvent.findMany({
    where: { fixtureId },
    orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
  });

  return res.json({ fixtureId, events });
});

router.get("/:gameweek/odds", async (req, res) => {
  const gameweek = Number(req.params.gameweek);
  if (!Number.isInteger(gameweek) || gameweek < 1) {
    return res.status(400).json({ error: "Route param 'gameweek' must be a positive integer" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: { gameweek },
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true } },
      awayTeam: { select: { id: true, name: true, shortName: true } },
    },
    orderBy: { kickoffTime: "asc" },
  });

  const odds = fixtures
    .filter((f) => f.homeOdds != null || f.drawOdds != null || f.awayOdds != null)
    .map((f) => ({
      fixtureId: f.id,
      gameweek: f.gameweek,
      kickoffTime: f.kickoffTime,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeOdds: f.homeOdds,
      drawOdds: f.drawOdds,
      awayOdds: f.awayOdds,
      oddsUpdatedAt: f.oddsUpdatedAt,
    }));

  return res.json({ gameweek, odds });
});

router.post("/:gameweek/process-results", authMiddleware, async (req, res) => {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const parsed = gameweekParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Route param 'gameweek' must be a positive integer" });
  }

  const result = await processGameweekResults(parsed.data.gameweek);
  return res.json({ success: true, result });
});

router.post("/:gameweek/sync-odds", authMiddleware, async (req, res) => {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const parsed = gameweekParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Route param 'gameweek' must be a positive integer" });
  }

  const result = await syncOddsForGameweek(parsed.data.gameweek);
  return res.json({ success: true, result });
});

export default router;
