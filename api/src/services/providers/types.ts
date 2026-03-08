export interface RawFixture {
  externalId: number;
  apiFootballId?: number | null;
  competition: string;
  gameweek: number;
  homeTeamExternalId: number;
  awayTeamExternalId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  kickoffTime: Date;
}

export interface RawTeam {
  externalId: number;
  apiFootballId?: number | null;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface RawLiveMatch {
  externalMatchId: number;
  homeTeamExternalId: number;
  awayTeamExternalId: number;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  kickoffTime?: Date;
}

export interface RawMatchEvent {
  type: string;
  minute: number;
  teamExternalId: number;
  playerName?: string;
  detail?: string;
}

export interface RawOddsMatch {
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}

export interface FixtureProvider {
  getSeasonFixtures(competition: string, season: string): Promise<RawFixture[]>;
  getGameweekFixtures(competition: string, gameweek: number): Promise<RawFixture[]>;
  getTeams(competition: string, season: string): Promise<RawTeam[]>;
}

export interface LiveScoreProvider {
  getLiveMatches(competition: string): Promise<RawLiveMatch[]>;
  getMatchEvents(externalMatchId: number): Promise<RawMatchEvent[]>;
}

export interface OddsProvider {
  getPreMatchOdds(sportKey: string, regions: string): Promise<RawOddsMatch[]>;
}
