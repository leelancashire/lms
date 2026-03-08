import { PickResult } from "@prisma/client";
import { prisma } from "../config/db";
import { getIO } from "../sockets";
import { notifyEliminated, notifyLeagueNoWinner, notifyLeagueWinner, notifySurvived } from "./notifications";

const PROCESSABLE_STATUSES = new Set<string>(["FINISHED", "POSTPONED"]);

interface FixtureLite {
  id: string;
  gameweek: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  kickoffTime: Date;
}

interface LeagueLite {
  id: string;
  name?: string;
}

interface LeagueMemberLite {
  id: string;
  leagueId: string;
  userId: string;
  status: "ALIVE" | "ELIMINATED" | "WINNER";
  joinedAt: Date;
}

interface PickLite {
  id: string;
  teamId: number;
  team?: { name: string };
}

export interface ResultProcessorDb {
  fixture: {
    findMany(args: { where: { gameweek: number }; orderBy?: { kickoffTime: "asc" } }): Promise<FixtureLite[]>;
  };
  league: {
    findMany(args: { where: { status: "ACTIVE" }; select: { id: true; name?: true } }): Promise<LeagueLite[]>;
    update(args: { where: { id: string }; data: { status: "COMPLETED" } }): Promise<unknown>;
  };
  leagueMember: {
    findMany(args: {
      where: { leagueId: string; status?: "ALIVE" };
      select: { id: true; leagueId: true; userId: true; status: true; joinedAt: true };
    }): Promise<LeagueMemberLite[]>;
    update(args: {
      where: { id: string };
      data: { status: "ELIMINATED" | "WINNER"; eliminatedGameweek?: number | null };
    }): Promise<unknown>;
  };
  pick: {
    findUnique(args: {
      where: { leagueId_userId_gameweek: { leagueId: string; userId: string; gameweek: number } };
      select: { id: true; teamId: true; team?: { select: { name: true } } };
    }): Promise<PickLite | null>;
    update(args: { where: { id: string }; data: { result: PickResult } }): Promise<unknown>;
  };
}

interface ResultProcessorNotifier {
  eliminated(userId: string, leagueName: string, reason: string): Promise<void>;
  survived(userId: string, teamName: string, nextGameweek: number): Promise<void>;
  leagueWinner(leagueId: string, winnerUserId: string, winnerName: string): Promise<void>;
  leagueNoWinner?: (leagueId: string) => Promise<void>;
}

const defaultNotifier: ResultProcessorNotifier = {
  eliminated: notifyEliminated,
  survived: notifySurvived,
  leagueWinner: notifyLeagueWinner,
  leagueNoWinner: notifyLeagueNoWinner,
};

export function calculateResult(
  fixture: Pick<FixtureLite, "status" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore">,
  teamId: number
): PickResult {
  if (fixture.status === "POSTPONED") return "WON";

  const isHome = fixture.homeTeamId === teamId;
  const teamScore = isHome ? fixture.homeScore : fixture.awayScore;
  const oppScore = isHome ? fixture.awayScore : fixture.homeScore;

  if (teamScore == null || oppScore == null) {
    return "PENDING";
  }

  if (teamScore > oppScore) return "WON";
  if (teamScore === oppScore) return "DRAWN";
  return "LOST";
}

function buildFirstFixtureByTeam(fixtures: FixtureLite[]): Map<number, FixtureLite> {
  const map = new Map<number, FixtureLite>();

  for (const fixture of fixtures) {
    if (!map.has(fixture.homeTeamId)) map.set(fixture.homeTeamId, fixture);
    if (!map.has(fixture.awayTeamId)) map.set(fixture.awayTeamId, fixture);
  }

  return map;
}

export async function processGameweekResults(
  gameweek: number,
  db: ResultProcessorDb = prisma,
  notifier: ResultProcessorNotifier = defaultNotifier
) {
  const fixtures = await db.fixture.findMany({
    where: { gameweek },
    orderBy: { kickoffTime: "asc" },
  });

  if (fixtures.length === 0) {
    return { processed: false, reason: "NO_FIXTURES" as const };
  }

  const allFinished = fixtures.every((f) => PROCESSABLE_STATUSES.has(f.status));
  if (!allFinished) {
    return { processed: false, reason: "NOT_READY" as const };
  }

  const fixtureByTeam = buildFirstFixtureByTeam(fixtures);
  const roundStart = fixtures[0]?.kickoffTime ?? new Date(0);
  const activeLeagues = await db.league.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  const io = getIO();

  for (const league of activeLeagues) {
    const leagueName = league.name ?? `League ${league.id}`;
    const aliveMembers = await db.leagueMember.findMany({
      where: { leagueId: league.id, status: "ALIVE" },
      select: { id: true, leagueId: true, userId: true, status: true, joinedAt: true },
    });

    for (const member of aliveMembers) {
      const pick = await db.pick.findUnique({
        where: {
          leagueId_userId_gameweek: {
            leagueId: league.id,
            userId: member.userId,
            gameweek,
          },
        },
        select: { id: true, teamId: true, team: { select: { name: true } } },
      });

      if (!pick) {
        // New joiners who entered after this round started should wait for next round.
        if (member.joinedAt.getTime() >= roundStart.getTime()) {
          continue;
        }

        await db.leagueMember.update({
          where: { id: member.id },
          data: { status: "ELIMINATED", eliminatedGameweek: gameweek },
        });
        await notifier.eliminated(
          member.userId,
          leagueName,
          `You were eliminated for not making a pick in GW${gameweek}.`
        );
        continue;
      }

      const fixture = fixtureByTeam.get(pick.teamId);
      if (!fixture) {
        await db.pick.update({ where: { id: pick.id }, data: { result: "LOST" } });
        await db.leagueMember.update({
          where: { id: member.id },
          data: { status: "ELIMINATED", eliminatedGameweek: gameweek },
        });
        await notifier.eliminated(member.userId, leagueName, "Your pick had no valid fixture and counted as a loss.");
        continue;
      }

      const result = calculateResult(fixture, pick.teamId);
      await db.pick.update({ where: { id: pick.id }, data: { result } });
      io?.to(`league:${league.id}`).emit("pickResult", {
        leagueId: league.id,
        gameweek,
        userId: member.userId,
        result,
      });

      if (result !== "WON") {
        await db.leagueMember.update({
          where: { id: member.id },
          data: { status: "ELIMINATED", eliminatedGameweek: gameweek },
        });
        await notifier.eliminated(member.userId, leagueName, "Your picked team did not win this gameweek.");
      } else {
        await notifier.survived(member.userId, pick.team?.name ?? `Team ${pick.teamId}`, gameweek + 1);
      }
    }

    const remainingAlive = await db.leagueMember.findMany({
      where: { leagueId: league.id, status: "ALIVE" },
      select: { id: true, leagueId: true, userId: true, status: true, joinedAt: true },
    });

    if (remainingAlive.length === 1) {
      await db.leagueMember.update({
        where: { id: remainingAlive[0].id },
        data: { status: "WINNER" },
      });
      await db.league.update({ where: { id: league.id }, data: { status: "COMPLETED" } });
      await notifier.leagueWinner(league.id, remainingAlive[0].userId, `User ${remainingAlive[0].userId}`);
    }

    if (remainingAlive.length === 0) {
      await db.league.update({ where: { id: league.id }, data: { status: "COMPLETED" } });
      await notifier.leagueNoWinner?.(league.id);
    }
  }

  return { processed: true as const };
}
