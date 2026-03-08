export const COMPETITIONS = [
  { code: "ALL", label: "All Leagues" },
  { code: "PL", label: "Premier League" },
  { code: "ELC", label: "Championship" },
  { code: "EL1", label: "League One" },
  { code: "EL2", label: "League Two" },
  { code: "SPL", label: "Scottish Premiership" },
  { code: "SCH", label: "Scottish Championship" },
] as const;

export type CompetitionCode = (typeof COMPETITIONS)[number]["code"];

export function competitionLabel(code?: string): string {
  return COMPETITIONS.find((c) => c.code === code)?.label ?? code ?? "Competition";
}
