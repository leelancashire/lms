import { Router } from "express";
import { prisma } from "../config/db";

const router = Router();

router.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
  });

  res.json({ teams });
});

router.get("/:teamId/form", async (req, res) => {
  const teamId = Number(req.params.teamId);
  const limit = Math.max(1, Math.min(20, Number(req.query.limit ?? 6)));

  if (!Number.isInteger(teamId) || teamId < 1) {
    return res.status(400).json({ error: "Route param 'teamId' must be a positive integer" });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, shortName: true, crestUrl: true },
  });

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      status: { in: ["FINISHED", "POSTPONED"] },
    },
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true, crestUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, crestUrl: true } },
    },
    orderBy: { kickoffTime: "desc" },
    take: limit,
  });

  const form = fixtures.map((fixture) => {
    const isHome = fixture.homeTeamId === teamId;
    const goalsFor = isHome ? fixture.homeScore : fixture.awayScore;
    const goalsAgainst = isHome ? fixture.awayScore : fixture.homeScore;
    const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;

    let result: "W" | "D" | "L" | "P";
    if (fixture.status === "POSTPONED") {
      result = "P";
    } else if ((goalsFor ?? 0) > (goalsAgainst ?? 0)) {
      result = "W";
    } else if ((goalsFor ?? 0) === (goalsAgainst ?? 0)) {
      result = "D";
    } else {
      result = "L";
    }

    return {
      fixtureId: fixture.id,
      gameweek: fixture.gameweek,
      kickoffTime: fixture.kickoffTime,
      status: fixture.status,
      isHome,
      opponent,
      goalsFor,
      goalsAgainst,
      result,
    };
  });

  return res.json({ team, form });
});

export default router;
