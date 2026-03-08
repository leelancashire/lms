import { env } from "../../config/env";
import type { LiveScoreProvider, RawLiveMatch, RawMatchEvent } from "./types";

const API_FOOTBALL_PL_LEAGUE_ID = 39;
const API_FOOTBALL_SEASON = 2025;

interface ApiFootballFixtureResponse {
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
