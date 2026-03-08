import cron from "node-cron";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { notifyMatchKickoff, notifyTeamConceded, notifyTeamScored } from "./notifications";
import { ApiFootballProvider } from "./providers/apiFootball";
import type { RawLiveMatch, RawMatchEvent } from "./providers/types";
import { getIO } from "../sockets";

const provider = new ApiFootballProvider();

let budgetDate = "";
let budgetRequests = 0;
let warned80 = false;
let warned95 = false;
const hardStop = Math.min(env.API_FOOTBALL_DAILY_LIMIT, 95);

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resetBudgetIfNeeded() {
  const key = utcDateKey(new Date());
  if (budgetDate !== key) {
    budgetDate = key;
    budgetRequests = 0;
    warned80 = false;
    warned95 = false;
  }
}

function consumeBudget(units = 1): boolean {
  resetBudgetIfNeeded();

  if (budgetRequests + units > hardStop) {
    if (!warned95) {
      console.warn(`API-Football budget cap reached for today; live polling paused at ${hardStop} requests.`);
      warned95 = true;
    }
    return false;
  }

  budgetRequests += units;
  if (budgetRequests >= 80 && !warned80) {
    console.warn(`API-Football usage warning: ${budgetRequests} requests used today.`);
    warned80 = true;
  }

  console.log(`API-Football requests today: ${budgetRequests}`);
  return true;
}

function resolveFixtureStatus(status: RawLiveMatch["status"]) {
  if (status === "LIVE") return "LIVE" as const;
  if (status === "FINISHED") return "FINISHED" as const;
  if (status === "POSTPONED") return "POSTPONED" as const;
  return "SCHEDULED" as const;
}

async function resolveFixture(match: RawLiveMatch) {
  const byApiId = await prisma.fixture.findUnique({
    where: { apiFootballId: match.externalMatchId },
    include: {
      homeTeam: { select: { apiFootballId: true, name: true } },
      awayTeam: { select: { apiFootballId: true, name: true } },
    },
  });
  if (byApiId) return byApiId;

  const candidate = await prisma.fixture.findFirst({
    where: {
      apiFootballId: null,
      homeTeam: { apiFootballId: match.homeTeamExternalId },
      awayTeam: { apiFootballId: match.awayTeamExternalId },
      kickoffTime: {
        gte: new Date(Date.now() - 18 * 60 * 60 * 1000),
        lte: new Date(Date.now() + 18 * 60 * 60 * 1000),
      },
    },
    include: {
      homeTeam: { select: { apiFootballId: true, name: true } },
      awayTeam: { select: { apiFootballId: true, name: true } },
    },
    orderBy: { kickoffTime: "asc" },
  });

  if (!candidate) return null;

  return prisma.fixture.update({
    where: { id: candidate.id },
    data: { apiFootballId: match.externalMatchId },
    include: {
      homeTeam: { select: { apiFootballId: true, name: true } },
      awayTeam: { select: { apiFootballId: true, name: true } },
    },
  });
}

async function notifyKickoffAndGoals(params: {
  fixtureId: string;
  gameweek: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  prevStatus: string;
  nextStatus: string;
  prevHomeScore: number | null;
  prevAwayScore: number | null;
  nextHomeScore: number | null;
  nextAwayScore: number | null;
}) {
  const rawPicks = await prisma.pick.findMany({
    where: {
      gameweek: params.gameweek,
      teamId: { in: [params.homeTeamId, params.awayTeamId] },
      league: { status: "ACTIVE" },
    },
    select: { userId: true, teamId: true, leagueId: true },
  });

  const picks: Array<{ userId: string; teamId: number }> = [];
  for (const pick of rawPicks) {
    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: pick.leagueId,
          userId: pick.userId,
        },
      },
      select: { status: true },
    });
    if (membership?.status === "ALIVE") {
      picks.push({ userId: pick.userId, teamId: pick.teamId });
    }
  }

  if (params.prevStatus !== "LIVE" && params.nextStatus === "LIVE") {
    for (const pick of picks) {
      const isHomePick = pick.teamId === params.homeTeamId;
      const teamName = isHomePick ? params.homeTeamName : params.awayTeamName;
      const opponent = isHomePick ? params.awayTeamName : params.homeTeamName;
      await notifyMatchKickoff(pick.userId, teamName, opponent);
    }
  }

  const prevHome = params.prevHomeScore ?? 0;
  const prevAway = params.prevAwayScore ?? 0;
  const nextHome = params.nextHomeScore ?? 0;
  const nextAway = params.nextAwayScore ?? 0;

  const homeScored = nextHome > prevHome;
  const awayScored = nextAway > prevAway;

  if (!homeScored && !awayScored) return;

  for (const pick of picks) {
    const pickedHome = pick.teamId === params.homeTeamId;
    const pickedAway = pick.teamId === params.awayTeamId;

    if (homeScored) {
      if (pickedHome) {
        await notifyTeamScored(pick.userId, params.homeTeamName, params.awayTeamName, nextHome, nextAway);
      } else if (pickedAway) {
        await notifyTeamConceded(pick.userId, params.awayTeamName, params.homeTeamName, nextAway, nextHome);
      }
    }

    if (awayScored) {
      if (pickedAway) {
        await notifyTeamScored(pick.userId, params.awayTeamName, params.homeTeamName, nextAway, nextHome);
      } else if (pickedHome) {
        await notifyTeamConceded(pick.userId, params.homeTeamName, params.awayTeamName, nextHome, nextAway);
      }
    }
  }
}

async function upsertAndBroadcastEvents(
  fixture: { id: string; gameweek: number; homeTeam: { apiFootballId: number | null }; awayTeam: { apiFootballId: number | null } },
  rawEvents: RawMatchEvent[]
) {
  const io = getIO();

  for (const event of rawEvents) {
    const teamSide =
      event.teamExternalId === fixture.homeTeam.apiFootballId
        ? "home"
        : event.teamExternalId === fixture.awayTeam.apiFootballId
          ? "away"
          : "home";

    const exists = await prisma.matchEvent.findFirst({
      where: {
        fixtureId: fixture.id,
        type: event.type,
        minute: event.minute,
        teamSide,
        playerName: event.playerName ?? null,
        detail: event.detail ?? null,
      },
      select: { id: true },
    });

    if (exists) continue;

    const created = await prisma.matchEvent.create({
      data: {
        fixtureId: fixture.id,
        type: event.type,
        minute: event.minute,
        teamSide,
        playerName: event.playerName,
        detail: event.detail,
      },
    });

    io?.to(`fixture:${fixture.id}`).emit("matchEvent", {
      fixtureId: fixture.id,
      type: created.type,
      detail: created.detail,
      minute: created.minute,
      teamSide: created.teamSide,
      playerName: created.playerName,
    });

    io?.to(`gameweek:${fixture.gameweek}`).emit("matchEvent", {
      fixtureId: fixture.id,
      type: created.type,
      detail: created.detail,
      minute: created.minute,
      teamSide: created.teamSide,
      playerName: created.playerName,
    });
  }
}

async function pollLiveScoresOnce() {
  const now = new Date();

  const activeWindowFixtures = await prisma.fixture.findMany({
    where: {
      kickoffTime: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
      status: { not: "FINISHED" },
    },
    select: { id: true },
    take: 1,
  });

  if (activeWindowFixtures.length === 0) return;

  if (!consumeBudget(1)) return;

  const matches = await provider.getLiveMatches("PL");
  const io = getIO();

  for (const match of matches) {
    const fixture = await resolveFixture(match);
    if (!fixture) continue;

    const previousStatus = fixture.status;
    const previousHomeScore = fixture.homeScore;
    const previousAwayScore = fixture.awayScore;

    const nextStatus = resolveFixtureStatus(match.status);
    const updated = await prisma.fixture.update({
      where: { id: fixture.id },
      data: {
        status: nextStatus,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    const scoreChanged =
      previousHomeScore !== updated.homeScore || previousAwayScore !== updated.awayScore || previousStatus !== updated.status;

    if (scoreChanged) {
      io?.to(`fixture:${updated.id}`).emit("scoreUpdate", {
        fixtureId: updated.id,
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
        minute: updated.minute,
        status: updated.status,
      });
      io?.to(`gameweek:${updated.gameweek}`).emit("scoreUpdate", {
        fixtureId: updated.id,
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
        minute: updated.minute,
        status: updated.status,
      });

      await notifyKickoffAndGoals({
        fixtureId: updated.id,
        gameweek: updated.gameweek,
        homeTeamId: updated.homeTeamId,
        awayTeamId: updated.awayTeamId,
        homeTeamName: updated.homeTeam.name,
        awayTeamName: updated.awayTeam.name,
        prevStatus: previousStatus,
        nextStatus: updated.status,
        prevHomeScore: previousHomeScore,
        prevAwayScore: previousAwayScore,
        nextHomeScore: updated.homeScore,
        nextAwayScore: updated.awayScore,
      });
    }

    if (updated.status === "LIVE") {
      if (!consumeBudget(1)) continue;
      const events = await provider.getMatchEvents(match.externalMatchId);
      await upsertAndBroadcastEvents(updated, events);
    }
  }
}

export function startLiveScoresService() {
  if (!env.API_FOOTBALL_KEY) {
    console.warn("API_FOOTBALL_KEY not set. LiveScores service is disabled (fallback to football-data.org polling).");
    return;
  }

  cron.schedule("* * * * *", () => {
    void pollLiveScoresOnce().catch((error) => {
      console.error("Live scores poll failed", error);
    });
  });

  void pollLiveScoresOnce().catch((error) => {
    console.error("Initial live scores poll failed", error);
  });
}
