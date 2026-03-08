import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../config/db";
import { HttpError } from "../utils/httpError";

type PickTx = Pick<Prisma.TransactionClient, "leagueMember" | "fixture" | "pick">;

export interface SubmitPickInput {
  leagueId: string;
  userId: string;
  teamId: number;
  now?: Date;
}

export async function submitPickInTransaction(tx: PickTx, input: SubmitPickInput) {
  const now = input.now ?? new Date();

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

  const gameweeks = await tx.fixture.groupBy({
    by: ["gameweek"],
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

  const gameweek = currentGw.gameweek;
  const deadline = currentGw._min.kickoffTime;

  const teamFixture = await tx.fixture.findFirst({
    where: {
      gameweek,
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
