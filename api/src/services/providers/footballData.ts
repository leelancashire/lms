import { env } from "../../config/env";
import type { FixtureProvider, RawFixture, RawTeam } from "./types";

type FootballDataMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | string;

interface FootballDataMatch {
  id: number;
  matchday: number;
  status: FootballDataMatchStatus;
  utcDate: string;
  homeTeam: { id: number };
  awayTeam: { id: number };
  score?: {
    fullTime?: {
      home: number | null;
      away: number | null;
    };
  };
}

interface FootballDataTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

function mapStatus(status: FootballDataMatchStatus): RawFixture["status"] {
  if (status === "SCHEDULED" || status === "TIMED") return "SCHEDULED";
  if (status === "IN_PLAY" || status === "PAUSED") return "LIVE";
  if (status === "FINISHED") return "FINISHED";
  if (status === "POSTPONED") return "POSTPONED";
  return "SCHEDULED";
}

async function fetchFootballData<T>(path: string): Promise<T> {
  const res = await fetch(`${env.FOOTBALL_DATA_ORG_BASE_URL}${path}`, {
    headers: {
      "X-Auth-Token": env.FOOTBALL_DATA_ORG_API_KEY ?? "",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org request failed (${res.status}): ${body}`);
  }

  return (await res.json()) as T;
}

export class FootballDataProvider implements FixtureProvider {
  async getSeasonFixtures(competition: string, season: string): Promise<RawFixture[]> {
    const data = await fetchFootballData<{ matches: FootballDataMatch[] }>(
      `/competitions/${competition}/matches?season=${season}`
    );

    return data.matches.map((m) => ({
      externalId: m.id,
      competition,
      gameweek: m.matchday,
      homeTeamExternalId: m.homeTeam.id,
      awayTeamExternalId: m.awayTeam.id,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      status: mapStatus(m.status),
      kickoffTime: new Date(m.utcDate),
    }));
  }

  async getGameweekFixtures(competition: string, gameweek: number): Promise<RawFixture[]> {
    const data = await fetchFootballData<{ matches: FootballDataMatch[] }>(
      `/competitions/${competition}/matches?matchday=${gameweek}`
    );

    return data.matches.map((m) => ({
      externalId: m.id,
      competition,
      gameweek: m.matchday,
      homeTeamExternalId: m.homeTeam.id,
      awayTeamExternalId: m.awayTeam.id,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      status: mapStatus(m.status),
      kickoffTime: new Date(m.utcDate),
    }));
  }

  async getTeams(competition: string, season: string): Promise<RawTeam[]> {
    const data = await fetchFootballData<{ teams: FootballDataTeam[] }>(
      `/competitions/${competition}/teams?season=${season}`
    );

    return data.teams.map((t) => ({
      externalId: t.id,
      name: t.name,
      shortName: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? t.name.slice(0, 3).toUpperCase(),
      crestUrl: t.crest ?? null,
    }));
  }
}
