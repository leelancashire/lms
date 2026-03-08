import { env } from "../../config/env";
import type { OddsProvider, RawOddsMatch } from "./types";

interface OddsApiResponseItem {
  sport_key?: string;
  sport_title?: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

function toRawOddsMatches(data: OddsApiResponseItem[]): RawOddsMatch[] {
  return data.map((item) => {
    const homePrices: number[] = [];
    const drawPrices: number[] = [];
    const awayPrices: number[] = [];

    for (const bookmaker of item.bookmakers ?? []) {
      const h2h = bookmaker.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;

      const home = h2h.outcomes.find((o) => o.name.toLowerCase() === item.home_team.toLowerCase());
      const away = h2h.outcomes.find((o) => o.name.toLowerCase() === item.away_team.toLowerCase());
      const draw = h2h.outcomes.find((o) => o.name.toLowerCase() === "draw");

      if (home?.price != null) homePrices.push(home.price);
      if (draw?.price != null) drawPrices.push(draw.price);
      if (away?.price != null) awayPrices.push(away.price);
    }

    const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

    return {
      homeTeam: item.home_team,
      awayTeam: item.away_team,
      kickoffTime: new Date(item.commence_time),
      homeOdds: avg(homePrices),
      drawOdds: avg(drawPrices),
      awayOdds: avg(awayPrices),
    };
  });
}

export class OddsApiProvider implements OddsProvider {
  async getPreMatchOdds(sportKey: string, regions: string): Promise<RawOddsMatch[]> {
    const params = new URLSearchParams({
      apiKey: env.ODDS_API_KEY ?? "",
      regions,
      markets: "h2h",
      oddsFormat: "decimal",
      dateFormat: "iso",
    });

    const response = await fetch(`${env.ODDS_API_BASE_URL}/sports/${sportKey}/odds?${params.toString()}`);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Odds API request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OddsApiResponseItem[];
    if (data.length > 0) return toRawOddsMatches(data);

    // Fallback: use upcoming odds feed and keep only EPL rows.
    const fallbackResponse = await fetch(`${env.ODDS_API_BASE_URL}/sports/upcoming/odds?${params.toString()}`);
    if (!fallbackResponse.ok) {
      const body = await fallbackResponse.text();
      throw new Error(`Odds API fallback failed (${fallbackResponse.status}): ${body}`);
    }

    const upcoming = (await fallbackResponse.json()) as OddsApiResponseItem[];
    const epl = upcoming.filter((item) => {
      const key = item.sport_key?.toLowerCase() ?? "";
      const title = item.sport_title?.toLowerCase() ?? "";
      return key === "soccer_epl" || title.includes("premier league");
    });

    return toRawOddsMatches(epl);
  }
}
