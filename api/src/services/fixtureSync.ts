import cron from "node-cron";
import { COMPETITIONS, type CompetitionCode, type CompetitionDef } from "../config/competitions";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { processGameweekResults } from "./resultProcessor";
import { ApiFootballProvider } from "./providers/apiFootball";
import { FootballDataProvider } from "./providers/footballData";
import type { FixtureProvider, RawFixture } from "./providers/types";

const SEASON = "2025";
const MOCK_FDO_ID_MIN = 950000;
const MOCK_SHORT_PREFIX: Record<string, string> = {
  PL: "P",
  ELC: "C",
  EL1: "O",
  EL2: "T",
  SPL: "S",
  SCH: "H",
};

function mockBaseForCompetition(competition: CompetitionCode): number {
  return MOCK_FDO_ID_MIN + COMPETITIONS.findIndex((c) => c.code === competition) * 100000;
}

async function upsertTeams(provider: FixtureProvider, competition: string): Promise<void> {
  const teams = await provider.getTeams(competition, SEASON);

  for (const team of teams) {
    await prisma.team.upsert({
      where: { fdoId: team.externalId },
      update: {
        name: team.name,
        shortName: team.shortName,
        crestUrl: team.crestUrl,
        apiFootballId: team.apiFootballId ?? undefined,
      },
      create: {
        id: team.externalId,
        fdoId: team.externalId,
        apiFootballId: team.apiFootballId ?? undefined,
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
        apiFootballId: fixture.apiFootballId ?? undefined,
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
        apiFootballId: fixture.apiFootballId ?? undefined,
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

async function ensureMockCompetition(def: CompetitionDef): Promise<void> {
  const base = mockBaseForCompetition(def.code);
  const prefix = MOCK_SHORT_PREFIX[def.code] ?? "X";
  const existingTeams = await prisma.team.findMany({
    where: {
      id: {
        gte: base,
        lt: base + 100000,
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (existingTeams.length < def.teamCount) {
    for (let i = existingTeams.length + 1; i <= def.teamCount; i += 1) {
      const id = base + i;
      const shortName = `${prefix}${i.toString().padStart(2, "0")}`;
      await prisma.team.upsert({
        where: { id },
        update: {
          name: `${def.label} Team ${i}`,
          shortName,
          crestUrl: null,
        },
        create: {
          id,
          fdoId: id,
          name: `${def.label} Team ${i}`,
          shortName,
          crestUrl: null,
        },
      });
    }
  }
  for (let i = 1; i <= def.teamCount; i += 1) {
    const id = base + i;
    const shortName = `${prefix}${i.toString().padStart(2, "0")}`;
    await prisma.team.updateMany({
      where: { id },
      data: {
        name: `${def.label} Team ${i}`,
        shortName,
      },
    });
  }

  const existingCount = await prisma.fixture.count({ where: { competition: def.code } });
  if (existingCount > 0) return;

  const teams = await prisma.team.findMany({
    where: {
      id: {
        gte: base,
        lt: base + 100000,
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (teams.length < 2) return;

  const teamIds = teams.map((t) => t.id);
  const rounds = buildRoundRobinPairings(teamIds, 10);

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  start.setUTCHours(12, 0, 0, 0);

  let fixtureCounter = base + 50000;

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
          competition: def.code,
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
          competition: def.code,
        },
      });

      fixtureCounter += 1;
    }
  }

}

async function seedMockFixturesIfNeeded(): Promise<void> {
  for (const def of COMPETITIONS.filter((c) => c.code !== "ALL")) {
    await ensureMockCompetition(def);
  }
  console.warn("FOOTBALL_DATA_ORG_API_KEY is not set. Seeded 10 gameweeks of mock fixtures for all competitions.");
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
  const apiFallback = env.API_FOOTBALL_KEY ? new ApiFootballProvider() : null;
  for (const def of COMPETITIONS.filter((c) => c.code !== "ALL")) {
    const providerCompetition = def.providerCode ?? def.code;
    try {
      await upsertTeams(provider, providerCompetition);
      const fixtures = await provider.getSeasonFixtures(providerCompetition, SEASON);
      if (fixtures.length === 0) {
        if (apiFallback) {
          await upsertTeams(apiFallback, def.code);
          const fallbackFixtures = await apiFallback.getSeasonFixtures(def.code, SEASON);
          if (fallbackFixtures.length > 0) {
            const mapped = fallbackFixtures.map((f) => ({ ...f, competition: def.code }));
            await upsertFixtures(mapped);
            console.log(`Used API-Football fallback for ${def.code}: ${mapped.length} fixture(s).`);
            continue;
          }
        }
        console.warn(`Fixture sync returned 0 fixtures for ${def.code}; leaving this competition empty.`);
      } else {
        const mapped = fixtures.map((f) => ({ ...f, competition: def.code }));
        await upsertFixtures(mapped);
        continue;
      }
    } catch (error) {
      if (apiFallback) {
        try {
          await upsertTeams(apiFallback, def.code);
          const fallbackFixtures = await apiFallback.getSeasonFixtures(def.code, SEASON);
          if (fallbackFixtures.length > 0) {
            const mapped = fallbackFixtures.map((f) => ({ ...f, competition: def.code }));
            await upsertFixtures(mapped);
            console.log(`Used API-Football fallback for ${def.code} after football-data error: ${mapped.length} fixture(s).`);
            continue;
          }
        } catch (fallbackErr) {
          console.warn(`API-Football fallback failed for ${def.code}.`, fallbackErr);
        }
      }
      console.warn(`Fixture sync failed for ${def.code}; leaving this competition empty.`, error);
    }
  }
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
  const apiFallback = env.API_FOOTBALL_KEY ? new ApiFootballProvider() : null;

  const competitionCodes = Array.from(
    new Set(
      (
        await prisma.fixture.findMany({
          where: {
            gameweek: { in: gameweeks },
            kickoffTime: { gte: windowStart },
            status: { in: ["SCHEDULED", "LIVE"] },
          },
          select: { competition: true },
        })
      ).map((f) => f.competition)
    )
  );

  for (const competition of competitionCodes) {
    const providerCompetition = COMPETITIONS.find((c) => c.code === competition)?.providerCode ?? competition;
    if (!providerCompetition) continue;
    for (const gw of gameweeks) {
      const beforeMap = new Map<number, string>();
      const before = await prisma.fixture.findMany({
        where: { gameweek: gw, competition },
        select: { fdoId: true, status: true },
      });
      for (const f of before) beforeMap.set(f.fdoId, f.status);

      if (before.length === 0) continue;

      let fixtures: RawFixture[] = [];
      try {
        fixtures = await provider.getGameweekFixtures(providerCompetition, gw);
      } catch {
        fixtures = [];
      }
      if (fixtures.length === 0 && apiFallback) {
        fixtures = await apiFallback.getGameweekFixtures(competition, gw);
      }
      if (fixtures.length === 0) continue;
      await upsertFixtures(fixtures.map((f) => ({ ...f, competition })));

      const after = await prisma.fixture.findMany({
        where: { gameweek: gw, competition },
        select: { fdoId: true, status: true },
      });
      const transitioned = after.filter((f) => beforeMap.get(f.fdoId) !== "FINISHED" && f.status === "FINISHED");

      if (transitioned.length > 0) {
        console.log(`${competition} GW${gw}: ${transitioned.length} fixture(s) transitioned to FINISHED.`);
        const result = await processGameweekResults(gw, competition);
        if (result.processed) {
          console.log(`${competition} GW${gw}: result processor completed.`);
        }
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
