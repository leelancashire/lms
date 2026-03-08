import { prisma } from "../config/db";

export type GameweekStatus = "pre" | "active" | "complete";

export interface CurrentGameweekInfo {
  gameweek: number;
  deadline: Date;
  status: GameweekStatus;
}

export async function getGameweekDeadline(gameweek: number): Promise<Date | null> {
  const earliest = await prisma.fixture.findFirst({
    where: { gameweek },
    orderBy: { kickoffTime: "asc" },
    select: { kickoffTime: true },
  });

  return earliest?.kickoffTime ?? null;
}

export async function getCurrentGameweekInfo(): Promise<CurrentGameweekInfo | null> {
  const gameweeks = await prisma.fixture.groupBy({
    by: ["gameweek"],
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

export async function getNextOpenGameweekInfo(now = new Date()): Promise<CurrentGameweekInfo | null> {
  const gameweeks = await prisma.fixture.groupBy({
    by: ["gameweek"],
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
