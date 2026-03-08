import cron from "node-cron";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { processGameweekResults } from "./resultProcessor";
import { FootballDataProvider } from "./providers/footballData";
import type { FixtureProvider, RawFixture } from "./providers/types";

const COMPETITION = "PL";
const SEASON = "2025";
const MOCK_FDO_ID_MIN = 950000;

async function upsertTeams(provider: FixtureProvider): Promise<void> {
  const teams = await provider.getTeams(COMPETITION, SEASON);

  for (const team of teams) {
    await prisma.team.upsert({
      where: { fdoId: team.externalId },
      update: {
        name: team.name,
        shortName: team.shortName,
        crestUrl: team.crestUrl,
      },
      create: {
        id: team.externalId,
        fdoId: team.externalId,
        name: team.name,
        shortName: team.shortName,
        crestUrl: team.crestUrl,
      },
    });
  }
}

async function upsertFixtures(rawFixtures: RawFixture[]): Promise<void> {
  for (const fixture of rawFixtures) {
    const home = await prisma.team.findUnique({ where: { fdoId: fixture.homeTeamExternalId }, select: { id: true } });
    const away = await prisma.team.findUnique({ where: { fdoId: fixture.awayTeamExternalId }, select: { id: true } });

    if (!home || !away) continue;

    await prisma.fixture.upsert({
      where: { fdoId: fixture.externalId },
      update: {
        competition: fixture.competition,
        gameweek: fixture.gameweek,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        status: fixture.status,
        kickoffTime: fixture.kickoffTime,
      },
      create: {
        fdoId: fixture.externalId,
        competition: fixture.competition,
        gameweek: fixture.gameweek,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        status: fixture.status,
        kickoffTime: fixture.kickoffTime,
      },
    });
  }
}

function buildRoundRobinPairings(teamIds: number[], rounds: number): Array<Array<[number, number]>> {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(-1);

  const n = ids.length;
  const half = n / 2;
  const schedule: Array<Array<[number, number]>> = [];

  for (let round = 0; round < rounds; round += 1) {
    const pairings: Array<[number, number]> = [];
    for (let i = 0; i < half; i += 1) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a !== -1 && b !== -1) {
        const homeAway: [number, number] = round % 2 === 0 ? [a, b] : [b, a];
        pairings.push(homeAway);
      }
    }
    schedule.push(pairings);

    const fixed = ids[0];
    const rest = ids.slice(1);
    rest.unshift(rest.pop() as number);
    ids.splice(0, ids.length, fixed, ...rest);
  }

  return schedule;
}

async function seedMockFixturesIfNeeded(): Promise<void> {
  const existingCount = await prisma.fixture.count();
  if (existingCount > 0) return;

  const teams = await prisma.team.findMany({ orderBy: { id: "asc" }, select: { id: true } });
  if (teams.length < 20) {
    console.warn("Skipping mock fixture seed: expected 20 teams in DB.");
    return;
  }

  const teamIds = teams.map((t) => t.id);
  const rounds = buildRoundRobinPairings(teamIds, 10);

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  start.setUTCHours(12, 0, 0, 0);

  let fixtureCounter = 950000;

  for (let gw = 1; gw <= rounds.length; gw += 1) {
    const gwStart = new Date(start);
    gwStart.setUTCDate(start.getUTCDate() + (gw - 1) * 7);

    const pairings = rounds[gw - 1];

    for (let i = 0; i < pairings.length; i += 1) {
      const [homeTeamId, awayTeamId] = pairings[i];
      const kickoffTime = new Date(gwStart);
      kickoffTime.setUTCHours(12 + (i % 5) * 2, (i % 2) * 30, 0, 0);

      let status: RawFixture["status"] = "SCHEDULED";
      let minute: number | null = null;
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      const diffMs = now.getTime() - kickoffTime.getTime();
      if (diffMs > 2.5 * 60 * 60 * 1000) {
        status = "FINISHED";
        homeScore = (homeTeamId + gw + i) % 4;
        awayScore = (awayTeamId + gw + i) % 3;
      } else if (diffMs > 0 && diffMs <= 2.5 * 60 * 60 * 1000) {
        status = "LIVE";
        minute = Math.max(1, Math.min(95, Math.floor(diffMs / 60000)));
        homeScore = (homeTeamId + i) % 3;
        awayScore = (awayTeamId + i) % 2;
      }

      await prisma.fixture.upsert({
        where: { fdoId: fixtureCounter },
        update: {
          gameweek: gw,
          homeTeamId,
          awayTeamId,
          kickoffTime,
          status,
          minute,
          homeScore,
          awayScore,
          competition: COMPETITION,
        },
        create: {
          fdoId: fixtureCounter,
          gameweek: gw,
          homeTeamId,
          awayTeamId,
          kickoffTime,
          status,
          minute,
          homeScore,
          awayScore,
          competition: COMPETITION,
        },
      });

      fixtureCounter += 1;
    }
  }

  console.warn("FOOTBALL_DATA_ORG_API_KEY is not set. Seeded 10 gameweeks of mock fixtures.");
}

async function clearMockFixturesIfUsingRealApi(): Promise<void> {
  const mockFixtures = await prisma.fixture.findMany({
    where: { fdoId: { gte: MOCK_FDO_ID_MIN } },
    select: { id: true },
  });
  if (mockFixtures.length === 0) return;

  const fixtureIds = mockFixtures.map((f) => f.id);
  await prisma.matchEvent.deleteMany({
    where: { fixtureId: { in: fixtureIds } },
  });
  await prisma.fixture.deleteMany({
    where: { id: { in: fixtureIds } },
  });

  console.log(`Removed ${mockFixtures.length} mock fixture(s) before real API sync.`);
}

export async function fullSyncFixturesAndTeams(): Promise<void> {
  if (!env.FOOTBALL_DATA_ORG_API_KEY) {
    await seedMockFixturesIfNeeded();
    return;
  }

  await clearMockFixturesIfUsingRealApi();
  const provider = new FootballDataProvider();
  await upsertTeams(provider);
  const fixtures = await provider.getSeasonFixtures(COMPETITION, SEASON);
  await upsertFixtures(fixtures);
}

export async function syncRecentFinishedMatches(): Promise<void> {
  if (!env.FOOTBALL_DATA_ORG_API_KEY) return;

  const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const recentFixtures = await prisma.fixture.findMany({
    where: {
      kickoffTime: { gte: windowStart },
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    select: { gameweek: true },
  });

  const gameweeks = Array.from(new Set(recentFixtures.map((f) => f.gameweek)));
  if (gameweeks.length === 0) return;

  const provider = new FootballDataProvider();

  for (const gw of gameweeks) {
    const beforeMap = new Map<number, string>();
    const before = await prisma.fixture.findMany({ where: { gameweek: gw }, select: { fdoId: true, status: true } });
    for (const f of before) beforeMap.set(f.fdoId, f.status);

    const fixtures = await provider.getGameweekFixtures(COMPETITION, gw);
    await upsertFixtures(fixtures);

    const after = await prisma.fixture.findMany({ where: { gameweek: gw }, select: { fdoId: true, status: true } });
    const transitioned = after.filter((f) => beforeMap.get(f.fdoId) !== "FINISHED" && f.status === "FINISHED");

    if (transitioned.length > 0) {
      console.log(`GW${gw}: ${transitioned.length} fixture(s) transitioned to FINISHED.`);
      const result = await processGameweekResults(gw);
      if (result.processed) {
        console.log(`GW${gw}: result processor completed.`);
      }
    }
  }
}

export function startFixtureSyncJobs(): void {
  cron.schedule("0 4 * * *", () => {
    void fullSyncFixturesAndTeams().catch((err) => {
      console.error("Daily fixture sync failed", err);
    });
  }, { timezone: "UTC" });

  cron.schedule("*/5 * * * *", () => {
    void syncRecentFinishedMatches().catch((err) => {
      console.error("5-minute finished-match sync failed", err);
    });
  });

  void fullSyncFixturesAndTeams().catch((err) => {
    console.error("Startup fixture sync failed", err);
  });
}
