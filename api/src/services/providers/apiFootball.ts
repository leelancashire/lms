import { env } from "../../config/env";
import type { FixtureProvider, LiveScoreProvider, RawFixture, RawLiveMatch, RawMatchEvent, RawTeam } from "./types";

const API_FOOTBALL_PL_LEAGUE_ID = 39;
const API_FOOTBALL_SEASON = 2025;
const API_FOOTBALL_TEAM_FDO_BASE = 1_100_000_000;
const API_FOOTBALL_FIXTURE_FDO_BASE = 1_600_000_000;

const COMP_TO_LEAGUE: Record<string, number> = {
  PL: 39,
  ELC: 40,
  EL1: 41,
  EL2: 42,
  SPL: 179,
  SCH: 180,
};

interface ApiFootballFixtureResponse {
  paging?: { current: number; total: number };
  response: Array<{
    fixture: {
      id: number;
      date: string;
      status: {
        short: string;
        elapsed: number | null;
      };
    };
    league: {
      id: number;
      round?: string;
    };
    teams: {
      home: { id: number };
      away: { id: number };
    };
    goals: {
      home: number | null;
      away: number | null;
    };
  }>;
}

interface ApiFootballEventResponse {
  response: Array<{
    time: { elapsed: number | null };
    team: { id: number | null };
    player: { name: string | null };
    type: string;
    detail: string | null;
  }>;
}

interface ApiFootballTeamsResponse {
  response: Array<{
    team: {
      id: number;
      name: string;
      code: string | null;
      logo: string | null;
    };
  }>;
}

function mapEventType(type: string, detail: string | null): string {
  const t = type.toLowerCase();
  const d = (detail ?? "").toLowerCase();

  if (t === "goal") return "goal";
  if (t === "card") {
    if (d.includes("red")) return "red_card";
    if (d.includes("yellow")) return "yellow_card";
    return "card";
  }
  if (t.includes("subst")) return "substitution";
  return t;
}

function mapApiFootballStatus(short: string): RawLiveMatch["status"] {
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(short)) return "POSTPONED";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) return "LIVE";
  return "SCHEDULED";
}

function mapApiFootballStatusToFixture(short: string): RawFixture["status"] {
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(short)) return "POSTPONED";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) return "LIVE";
  return "SCHEDULED";
}

function leagueIdForCompetition(competition: string): number | null {
  return COMP_TO_LEAGUE[competition] ?? null;
}

function syntheticTeamFdoId(apiTeamId: number): number {
  return API_FOOTBALL_TEAM_FDO_BASE + apiTeamId;
}

function syntheticFixtureFdoId(apiFixtureId: number): number {
  return API_FOOTBALL_FIXTURE_FDO_BASE + apiFixtureId;
}

async function fetchApiFootball<T>(path: string): Promise<T> {
  const response = await fetch(`${env.API_FOOTBALL_BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": env.API_FOOTBALL_KEY ?? "",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API-Football request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export class ApiFootballProvider implements LiveScoreProvider {
  async getSeasonFixtures(competition: string, season: string): Promise<RawFixture[]> {
    const leagueId = leagueIdForCompetition(competition);
    if (!leagueId) return [];
    const seasonNum = Number(season);
    if (!Number.isInteger(seasonNum)) return [];

    const rows: ApiFootballFixtureResponse["response"] = [];
    let page = 1;
    while (true) {
      const data = await fetchApiFootball<ApiFootballFixtureResponse>(
        `/fixtures?league=${leagueId}&season=${seasonNum}&page=${page}`
      );
      rows.push(...data.response);
      const total = data.paging?.total ?? 1;
      const current = data.paging?.current ?? page;
      if (current >= total) break;
      page += 1;
    }

    return rows.map((item) => ({
      externalId: syntheticFixtureFdoId(item.fixture.id),
      apiFootballId: item.fixture.id,
      competition,
      gameweek: Number(item.league.round?.split(" - ").pop()) || 1,
      homeTeamExternalId: syntheticTeamFdoId(item.teams.home.id),
      awayTeamExternalId: syntheticTeamFdoId(item.teams.away.id),
      homeScore: item.goals.home,
      awayScore: item.goals.away,
      status: mapApiFootballStatusToFixture(item.fixture.status.short),
      kickoffTime: new Date(item.fixture.date),
    }));
  }

  async getGameweekFixtures(competition: string, gameweek: number): Promise<RawFixture[]> {
    const leagueId = leagueIdForCompetition(competition);
    if (!leagueId) return [];
    const round = encodeURIComponent(`Regular Season - ${gameweek}`);
    const data = await fetchApiFootball<ApiFootballFixtureResponse>(
      `/fixtures?league=${leagueId}&season=${API_FOOTBALL_SEASON}&round=${round}`
    );

    return data.response.map((item) => ({
      externalId: syntheticFixtureFdoId(item.fixture.id),
      apiFootballId: item.fixture.id,
      competition,
      gameweek,
      homeTeamExternalId: syntheticTeamFdoId(item.teams.home.id),
      awayTeamExternalId: syntheticTeamFdoId(item.teams.away.id),
      homeScore: item.goals.home,
      awayScore: item.goals.away,
      status: mapApiFootballStatusToFixture(item.fixture.status.short),
      kickoffTime: new Date(item.fixture.date),
    }));
  }

  async getTeams(competition: string, season: string): Promise<RawTeam[]> {
    const leagueId = leagueIdForCompetition(competition);
    if (!leagueId) return [];
    const seasonNum = Number(season);
    if (!Number.isInteger(seasonNum)) return [];
    const data = await fetchApiFootball<ApiFootballTeamsResponse>(`/teams?league=${leagueId}&season=${seasonNum}`);
    return data.response.map((row) => ({
      externalId: syntheticTeamFdoId(row.team.id),
      apiFootballId: row.team.id,
      name: row.team.name,
      shortName: (row.team.code ?? row.team.name.slice(0, 3)).toUpperCase().slice(0, 3),
      crestUrl: row.team.logo,
    }));
  }

  async getLiveMatches(competition: string): Promise<RawLiveMatch[]> {
    if (competition !== "PL") return [];

    const data = await fetchApiFootball<ApiFootballFixtureResponse>(
      `/fixtures?league=${API_FOOTBALL_PL_LEAGUE_ID}&season=${API_FOOTBALL_SEASON}&live=all`
    );

    return data.response.map((item) => ({
      externalMatchId: item.fixture.id,
      homeTeamExternalId: item.teams.home.id,
      awayTeamExternalId: item.teams.away.id,
      homeScore: item.goals.home,
      awayScore: item.goals.away,
      minute: item.fixture.status.elapsed,
      status: mapApiFootballStatus(item.fixture.status.short),
      kickoffTime: new Date(item.fixture.date),
    }));
  }

  async getMatchEvents(externalMatchId: number): Promise<RawMatchEvent[]> {
    const data = await fetchApiFootball<ApiFootballEventResponse>(`/fixtures/events?fixture=${externalMatchId}`);

    return data.response
      .filter((event) => event.time.elapsed != null && event.team.id != null)
      .map((event) => ({
        type: mapEventType(event.type, event.detail),
        minute: event.time.elapsed ?? 0,
        teamExternalId: event.team.id ?? 0,
        playerName: event.player.name ?? undefined,
        detail: event.detail ?? undefined,
      }));
  }
}

// Keep a single provider implementation that supports both optional fixture sync fallback and live scores.
export type ApiFootballFixtureProvider = FixtureProvider;
