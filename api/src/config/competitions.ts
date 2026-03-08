export type CompetitionCode = "ALL" | "PL" | "ELC" | "EL1" | "EL2" | "SPL" | "SCH";

export interface CompetitionDef {
  code: CompetitionCode;
  label: string;
  areaCode: string;
  providerCode?: string;
  providerName: string;
  teamCount: number;
}

export const COMPETITIONS: CompetitionDef[] = [
  { code: "ALL", label: "All Leagues", areaCode: "INT", providerName: "All", teamCount: 0 },
  { code: "PL", label: "Premier League", areaCode: "ENG", providerCode: "PL", providerName: "Premier League", teamCount: 20 },
  { code: "ELC", label: "Championship", areaCode: "ENG", providerCode: "ELC", providerName: "Championship", teamCount: 24 },
  { code: "EL1", label: "League One", areaCode: "ENG", providerCode: "EL1", providerName: "League One", teamCount: 24 },
  { code: "EL2", label: "League Two", areaCode: "ENG", providerCode: "EL2", providerName: "League Two", teamCount: 24 },
  { code: "SPL", label: "Scottish Premiership", areaCode: "SCO", providerCode: "SPL", providerName: "Premier League", teamCount: 12 },
  // Scottish Championship often has no stable league-code in football-data v4; resolve by area+name.
  { code: "SCH", label: "Scottish Championship", areaCode: "SCO", providerName: "Championship", teamCount: 10 },
];

export function getCompetition(code: string): CompetitionDef | null {
  return COMPETITIONS.find((c) => c.code === code) ?? null;
}
