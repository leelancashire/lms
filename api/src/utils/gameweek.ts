import { prisma } from "../config/db";
import { env } from "../config/env";

export type GameweekStatus = "pre" | "active" | "complete";

export interface CurrentGameweekInfo {
  gameweek: number;
  deadline: Date;
  status: GameweekStatus;
}

function competitionWhere(competition?: string) {
  return competition && competition !== "ALL" ? { competition } : {};
}

export function getAdminActiveMatchDateRangeUtc():
  | { start: Date; end: Date; date: string }
  | null {
  const value = env.ADMIN_ACTIVE_MATCH_DATE;
  if (!value) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end, date: value };
}

export async function getGameweekDeadline(gameweek: number, competition?: string): Promise<Date | null> {
  const earliest = await prisma.fixture.findFirst({
    where: { gameweek, ...competitionWhere(competition) },
    orderBy: { kickoffTime: "asc" },
    select: { kickoffTime: true },
  });
  return earliest?.kickoffTime ?? null;
}

export async function getCurrentGameweekInfo(competition?: string): Promise<CurrentGameweekInfo | null> {
  const gameweeks = await prisma.fixture.groupBy({
    by: ["gameweek"],
    where: competitionWhere(competition),
    _min: { kickoffTime: true },
    _max: { kickoffTime: true },
    orderBy: { gameweek: "asc" },
  });

  if (gameweeks.length === 0) return null;

  const now = new Date();

  for (const gw of gameweeks) {
    const start = gw._min.kickoffTime;
    const end = gw._max.kickoffTime;
    if (!start || !end) continue;

    if (now < start) {
      return { gameweek: gw.gameweek, deadline: start, status: "pre" };
    }

    if (now >= start && now <= new Date(end.getTime() + 2 * 60 * 60 * 1000)) {
      return { gameweek: gw.gameweek, deadline: start, status: "active" };
    }
  }

  const last = gameweeks[gameweeks.length - 1];
  if (!last._min.kickoffTime) return null;

  return { gameweek: last.gameweek, deadline: last._min.kickoffTime, status: "complete" };
}

export async function getNextOpenGameweekInfo(now = new Date(), competition?: string): Promise<CurrentGameweekInfo | null> {
  const gameweeks = await prisma.fixture.groupBy({
    by: ["gameweek"],
    where: competitionWhere(competition),
    _min: { kickoffTime: true },
    _max: { kickoffTime: true },
    orderBy: { gameweek: "asc" },
  });

  if (gameweeks.length === 0) return null;

  for (const gw of gameweeks) {
    const start = gw._min.kickoffTime;
    if (!start) continue;
    if (now.getTime() < start.getTime()) {
      return { gameweek: gw.gameweek, deadline: start, status: "pre" };
    }
  }

  return null;
}
