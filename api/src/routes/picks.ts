import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { notifyPickConfirmed } from "../services/notifications";
import { submitPick } from "../services/picks";
import { getAdminActiveMatchDateRangeUtc, getGameweekDeadline, getNextOpenGameweekInfo } from "../utils/gameweek";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const leagueParamsSchema = z.object({
  leagueId: z.string().min(1),
});

const submitPickBodySchema = z.object({
  teamId: z.coerce.number().int().positive(),
});

const gameweekQuerySchema = z.object({
  gameweek: z.coerce.number().int().positive(),
});

router.post(
  "/",
  validate({ params: leagueParamsSchema, body: submitPickBodySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { leagueId } = req.params as z.infer<typeof leagueParamsSchema>;
      const { teamId } = req.body as z.infer<typeof submitPickBodySchema>;

      const result = await submitPick({
        leagueId,
        userId,
        teamId,
      });

      await notifyPickConfirmed(userId, result.pick.team.name, result.gameweek);

      return res.status(201).json({ pick: result.pick, gameweek: result.gameweek, deadline: result.deadline });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/mine", validate({ params: leagueParamsSchema }), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { leagueId } = req.params as z.infer<typeof leagueParamsSchema>;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, competition: true },
  });
  if (!league) return res.status(404).json({ error: "League not found" });

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this league" });
  }

  const picks = await prisma.pick.findMany({
    where: { leagueId, userId },
    include: { team: true },
    orderBy: { gameweek: "asc" },
  });

  const usedTeamIds = new Set(picks.map((p) => p.teamId));
  const openGw = await getNextOpenGameweekInfo(new Date(), "ALL");
  if (!openGw) {
    return res.json({ competition: league.competition, picks, availableTeams: [] });
  }
  const adminRange = getAdminActiveMatchDateRangeUtc();

  const teamIdsRows = await prisma.fixture.findMany({
    where: {
      gameweek: openGw.gameweek,
      ...(adminRange ? { kickoffTime: { gte: adminRange.start, lte: adminRange.end } } : {}),
    },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const teamIds = Array.from(new Set(teamIdsRows.flatMap((f) => [f.homeTeamId, f.awayTeamId])));

  const availableTeams = await prisma.team.findMany({
    where: {
      id: {
        in: teamIds,
        notIn: [...usedTeamIds],
      },
    },
    orderBy: { name: "asc" },
  });

  return res.json({ competition: league.competition, picks, availableTeams });
});

router.get("/", validate({ params: leagueParamsSchema, query: gameweekQuerySchema }), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { leagueId } = req.params as z.infer<typeof leagueParamsSchema>;
  const gameweek = Number((req.query as { gameweek?: unknown }).gameweek);
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, competition: true },
  });
  if (!league) return res.status(404).json({ error: "League not found" });

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this league" });
  }

  const deadline = await getGameweekDeadline(gameweek, "ALL");
  if (!deadline) {
    return res.status(404).json({ error: "No fixtures found for this gameweek" });
  }

  const now = new Date();
  const reveal = now.getTime() >= deadline.getTime();

  const picks = await prisma.pick.findMany({
    where: {
      leagueId,
      gameweek,
      ...(reveal ? {} : { userId }),
    },
    include: { team: true, user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ picks, revealed: reveal });
});

export default router;
