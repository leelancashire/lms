import { Router } from "express";
import { prisma } from "../config/db";

const router = Router();

router.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
  });

  res.json({ teams });
});

router.get("/form-strip", async (req, res) => {
  const limit = Math.max(1, Math.min(10, Number(req.query.limit ?? 5)));

  const fixtures = await prisma.fixture.findMany({
    where: {
      status: { in: ["FINISHED", "POSTPONED"] },
    },
    orderBy: { kickoffTime: "desc" },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
  });

  const stripMap = new Map<number, Array<"W" | "D" | "L" | "P">>();

  function pushResult(teamId: number, result: "W" | "D" | "L" | "P") {
    const arr = stripMap.get(teamId) ?? [];
    if (arr.length < limit) arr.push(result);
    stripMap.set(teamId, arr);
  }

  for (const fixture of fixtures) {
    const homeReady = (stripMap.get(fixture.homeTeamId)?.length ?? 0) < limit;
    const awayReady = (stripMap.get(fixture.awayTeamId)?.length ?? 0) < limit;
    if (!homeReady && !awayReady) continue;

    if (fixture.status === "POSTPONED") {
      if (homeReady) pushResult(fixture.homeTeamId, "P");
      if (awayReady) pushResult(fixture.awayTeamId, "P");
      continue;
    }

    const home = fixture.homeScore ?? 0;
    const away = fixture.awayScore ?? 0;

    if (home > away) {
      if (homeReady) pushResult(fixture.homeTeamId, "W");
      if (awayReady) pushResult(fixture.awayTeamId, "L");
    } else if (home < away) {
      if (homeReady) pushResult(fixture.homeTeamId, "L");
      if (awayReady) pushResult(fixture.awayTeamId, "W");
    } else {
      if (homeReady) pushResult(fixture.homeTeamId, "D");
      if (awayReady) pushResult(fixture.awayTeamId, "D");
    }
  }

  const teams = await prisma.team.findMany({
    select: { id: true },
  });

  return res.json({
    limit,
    strips: teams.map((team) => ({
      teamId: team.id,
      form: stripMap.get(team.id) ?? [],
    })),
  });
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
