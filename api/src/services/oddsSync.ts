import cron from "node-cron";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { OddsApiProvider } from "./providers/oddsApi";

const SPORT_KEY = "soccer_epl";
const REGIONS = "uk";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(fc|afc|cf|club|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameLikelyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  return overlap >= Math.min(2, Math.min(tokensA.size, tokensB.size));
}

async function targetGameweeksForToday(now: Date): Promise<number[]> {
  const groups = await prisma.fixture.groupBy({
    by: ["gameweek"],
    _min: { kickoffTime: true },
    orderBy: { gameweek: "asc" },
  });

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);

  const y = tomorrow.getUTCFullYear();
  const m = tomorrow.getUTCMonth();
  const d = tomorrow.getUTCDate();

  return groups
    .filter((g) => {
      const deadline = g._min.kickoffTime;
      if (!deadline) return false;
      return deadline.getUTCFullYear() === y && deadline.getUTCMonth() === m && deadline.getUTCDate() === d;
    })
    .map((g) => g.gameweek);
}

export async function syncOddsOnce(now = new Date()) {
  if (!env.ODDS_API_KEY) return;

  const gameweeks = await targetGameweeksForToday(now);
  if (gameweeks.length === 0) return;

  const provider = new OddsApiProvider();
  const odds = await provider.getPreMatchOdds(SPORT_KEY, REGIONS);
  console.log(`Odds sync: fetched ${odds.length} odds row(s).`);

  for (const gameweek of gameweeks) {
    const result = await syncOddsForGameweek(gameweek, odds);
    console.log(`Odds sync: GW${gameweek} updated ${result.updated}/${result.total} fixture(s).`);
  }
}

export async function syncOddsForGameweek(gameweek: number, preFetchedOdds?: Awaited<ReturnType<OddsApiProvider["getPreMatchOdds"]>>) {
  if (!env.ODDS_API_KEY) {
    throw new Error("ODDS_API_KEY is not configured");
  }

  const provider = new OddsApiProvider();
  const odds = preFetchedOdds ?? (await provider.getPreMatchOdds(SPORT_KEY, REGIONS));

  const fixtures = await prisma.fixture.findMany({
    where: { gameweek },
    include: { homeTeam: true, awayTeam: true },
  });

  let updated = 0;
  for (const fixture of fixtures) {
    const candidates = odds.filter((o) => {
      const kickoffDiff = Math.abs(o.kickoffTime.getTime() - fixture.kickoffTime.getTime());
      if (kickoffDiff > 4 * 60 * 60 * 1000) return false;

      const homeMatch = nameLikelyMatch(o.homeTeam, fixture.homeTeam.name);
      const awayMatch = nameLikelyMatch(o.awayTeam, fixture.awayTeam.name);
      return homeMatch && awayMatch;
    });

    if (candidates.length === 0) continue;

    const best = candidates.sort(
      (a, b) =>
        Math.abs(a.kickoffTime.getTime() - fixture.kickoffTime.getTime()) -
        Math.abs(b.kickoffTime.getTime() - fixture.kickoffTime.getTime())
    )[0];

    await prisma.fixture.update({
      where: { id: fixture.id },
      data: {
        homeOdds: best.homeOdds,
        drawOdds: best.drawOdds,
        awayOdds: best.awayOdds,
        oddsUpdatedAt: new Date(),
      },
    });
    updated += 1;
  }

  return { gameweek, total: fixtures.length, updated, fetched: odds.length };
}

export function startOddsSyncService() {
  if (!env.ODDS_API_KEY) {
    console.log("Odds API not configured, odds features disabled");
    return;
  }

  cron.schedule(
    "0 8 * * *",
    () => {
      void syncOddsOnce().catch((error) => {
        console.error("Odds sync failed", error);
      });
    },
    { timezone: "UTC" }
  );

  void syncOddsOnce().catch((error) => {
    console.error("Initial odds sync failed", error);
  });
}
