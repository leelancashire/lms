import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../config/db";
import { getAdminActiveMatchDateRangeUtc } from "../utils/gameweek";
import { HttpError } from "../utils/httpError";

type PickTx = Pick<Prisma.TransactionClient, "league" | "leagueMember" | "fixture" | "pick">;

export interface SubmitPickInput {
  leagueId: string;
  userId: string;
  teamId: number;
  now?: Date;
}

export async function submitPickInTransaction(tx: PickTx, input: SubmitPickInput) {
  const now = input.now ?? new Date();
  const league = await tx.league.findUnique({
    where: { id: input.leagueId },
    select: { id: true, competition: true },
  });
  if (!league) {
    throw new HttpError(404, "League not found");
  }

  const membership = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: input.leagueId,
        userId: input.userId,
      },
    },
  });

  if (!membership || membership.status !== "ALIVE") {
    throw new HttpError(403, "User is not an ALIVE member of this league");
  }
  // Picks are global across all supported leagues; filtering is controlled by active round date/window.
  const fixtureCompetitionFilter = {};
  const adminRange = getAdminActiveMatchDateRangeUtc();

  let gameweek: number;
  let deadline: Date;
  if (adminRange) {
    const fixturesInRange = await tx.fixture.findMany({
      where: {
        ...fixtureCompetitionFilter,
        kickoffTime: { gte: adminRange.start, lte: adminRange.end },
      },
      orderBy: { kickoffTime: "asc" },
      select: { gameweek: true, kickoffTime: true },
    });
    if (fixturesInRange.length === 0) {
      throw new HttpError(400, "No fixtures available for admin-selected date");
    }
    gameweek = fixturesInRange[0].gameweek;
    deadline = fixturesInRange[0].kickoffTime;
  } else {
    const gameweeks = await tx.fixture.groupBy({
      by: ["gameweek"],
      where: fixtureCompetitionFilter,
      _min: { kickoffTime: true },
      orderBy: { gameweek: "asc" },
    });

    if (gameweeks.length === 0) {
      throw new HttpError(400, "No fixtures available");
    }

    const currentGw = gameweeks.find((gw) => {
      const start = gw._min.kickoffTime;
      if (!start) return false;
      return now.getTime() < start.getTime();
    });

    if (!currentGw || !currentGw._min.kickoffTime) {
      throw new HttpError(400, "No open gameweek available");
    }
    gameweek = currentGw.gameweek;
    deadline = currentGw._min.kickoffTime;
  }

  const teamFixture = await tx.fixture.findFirst({
    where: {
      ...fixtureCompetitionFilter,
      gameweek,
      ...(adminRange ? { kickoffTime: { gte: adminRange.start, lte: adminRange.end } } : {}),
      OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
    },
    orderBy: { kickoffTime: "asc" },
  });

  if (!teamFixture) {
    throw new HttpError(400, "Selected team is not playing in this gameweek");
  }

  if (teamFixture.kickoffTime.getTime() <= now.getTime()) {
    throw new HttpError(400, "Selected team fixture has already kicked off");
  }

  try {
    const pick = await tx.pick.upsert({
      where: {
        leagueId_userId_gameweek: {
          leagueId: input.leagueId,
          userId: input.userId,
          gameweek,
        },
      },
      update: {
        teamId: input.teamId,
        result: "PENDING",
      },
      create: {
        leagueId: input.leagueId,
        userId: input.userId,
        gameweek,
        teamId: input.teamId,
      },
      include: {
        team: true,
      },
    });

    return { pick, gameweek, deadline };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      throw new HttpError(409, "Team already used in this league");
    }
    throw error;
  }
}

export async function submitPick(input: SubmitPickInput) {
  return prisma.$transaction((tx) => submitPickInTransaction(tx, input));
}
