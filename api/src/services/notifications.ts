import cron from "node-cron";
import { prisma } from "../config/db";
import { messaging } from "../config/firebase";

export interface PushMessage {
  title: string;
  body: string;
}

const sentReminderKeys = new Set<string>();

export async function sendPush(userId: string, message: PushMessage): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, fcmToken: true },
  });

  if (!user) return;

  if (!messaging || !user.fcmToken) {
    console.log(`[push:mock] user=${user.id} title="${message.title}" body="${message.body}"`);
    return;
  }

  try {
    await messaging.send({
      token: user.fcmToken,
      notification: {
        title: message.title,
        body: message.body,
      },
    });
  } catch (error) {
    console.warn(`Push send failed for user ${user.id}; falling back to log`, error);
    console.log(`[push:mock] user=${user.id} title="${message.title}" body="${message.body}"`);
  }
}

async function findUpcomingGameweekDeadline(now: Date) {
  const groups = await prisma.fixture.groupBy({
    by: ["gameweek"],
    _min: { kickoffTime: true },
    orderBy: { gameweek: "asc" },
  });

  const next = groups
    .map((g) => ({ gameweek: g.gameweek, deadline: g._min.kickoffTime }))
    .filter((g): g is { gameweek: number; deadline: Date } => Boolean(g.deadline))
    .find((g) => g.deadline.getTime() > now.getTime());

  return next ?? null;
}

async function notifyAliveMembersWithoutPick(gameweek: number, title: string, bodyBuilder: (leagueName: string) => string) {
  const activeLeagues = await prisma.league.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  });

  for (const league of activeLeagues) {
    const aliveMembers = await prisma.leagueMember.findMany({
      where: {
        leagueId: league.id,
        status: "ALIVE",
      },
      select: { userId: true },
    });

    if (aliveMembers.length === 0) continue;

    const userIds = aliveMembers.map((m) => m.userId);

    const picks = await prisma.pick.findMany({
      where: {
        leagueId: league.id,
        gameweek,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const pickedUserIds = new Set(picks.map((p) => p.userId));

    for (const userId of userIds) {
      if (!pickedUserIds.has(userId)) {
        await sendPush(userId, {
          title,
          body: bodyBuilder(league.name),
        });
      }
    }
  }
}

async function runDeadlineRelativeReminder(offsetMinutes: number, label: string) {
  const now = new Date();
  const upcoming = await findUpcomingGameweekDeadline(now);
  if (!upcoming) return;

  const minutesToDeadline = Math.floor((upcoming.deadline.getTime() - now.getTime()) / 60000);
  const key = `${label}:gw${upcoming.gameweek}:${upcoming.deadline.toISOString()}`;

  // 5-minute polling window
  const shouldSend = minutesToDeadline <= offsetMinutes && minutesToDeadline > offsetMinutes - 5;

  if (!shouldSend || sentReminderKeys.has(key)) return;

  sentReminderKeys.add(key);

  const title =
    label === "2h"
      ? `Last chance: GW${upcoming.gameweek} pick closes in 2 hours`
      : `Final warning: GW${upcoming.gameweek} pick closes in 30 minutes`;

  await notifyAliveMembersWithoutPick(upcoming.gameweek, title, (leagueName) => {
    if (label === "2h") return `League ${leagueName}: pick closes at ${upcoming.deadline.toISOString()}`;
    return `League ${leagueName}: only 30 minutes left to submit your pick.`;
  });
}

async function runFridayReminder() {
  const now = new Date();
  const upcoming = await findUpcomingGameweekDeadline(now);
  if (!upcoming) return;

  await notifyAliveMembersWithoutPick(
    upcoming.gameweek,
    `Reminder: Make your GW${upcoming.gameweek} pick`,
    (leagueName) => `League ${leagueName}: deadline is ${upcoming.deadline.toISOString()}`
  );
}

export function startNotificationCrons() {
  cron.schedule(
    "0 9 * * 5",
    () => {
      void runFridayReminder().catch((err) => {
        console.error("Friday reminder cron failed", err);
      });
    },
    { timezone: "UTC" }
  );

  cron.schedule("*/5 * * * *", () => {
    void runDeadlineRelativeReminder(120, "2h").catch((err) => {
      console.error("2-hour reminder cron failed", err);
    });
  });

  cron.schedule("*/5 * * * *", () => {
    void runDeadlineRelativeReminder(30, "30m").catch((err) => {
      console.error("30-minute reminder cron failed", err);
    });
  });
}

export async function notifyPickConfirmed(userId: string, teamName: string, gameweek: number) {
  await sendPush(userId, {
    title: `Pick confirmed for GW${gameweek}`,
    body: `Locked in: ${teamName}`,
  });
}

export async function notifyMatchKickoff(userId: string, teamName: string, opponentName: string) {
  await sendPush(userId, {
    title: `${teamName} has kicked off`,
    body: `${teamName} vs ${opponentName} is live. Good luck!`,
  });
}

export async function notifyTeamScored(
  userId: string,
  teamName: string,
  opponentName: string,
  teamScore: number,
  oppScore: number
) {
  await sendPush(userId, {
    title: `GOAL! ${teamName}`,
    body: `${teamName} ${teamScore} - ${oppScore} ${opponentName}`,
  });
}

export async function notifyTeamConceded(
  userId: string,
  teamName: string,
  opponentName: string,
  teamScore: number,
  oppScore: number
) {
  await sendPush(userId, {
    title: `${teamName} conceded`,
    body: `${teamName} ${teamScore} - ${oppScore} ${opponentName}`,
  });
}

export async function notifyEliminated(userId: string, leagueName: string, reason: string) {
  await sendPush(userId, {
    title: `Eliminated from ${leagueName}`,
    body: reason,
  });
}

export async function notifySurvived(userId: string, teamName: string, nextGameweek: number) {
  await sendPush(userId, {
    title: `${teamName} won - you survive`,
    body: `You are through to GW${nextGameweek}.`,
  });
}

export async function notifyLeagueWinner(leagueId: string, winnerUserId: string, winnerName: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });

  const leagueName = league?.name ?? "your league";

  await sendPush(winnerUserId, {
    title: `You won ${leagueName}`,
    body: "Last Man Standing! Congratulations.",
  });

  const members = await prisma.leagueMember.findMany({
    where: { leagueId },
    select: { userId: true },
  });

  for (const member of members) {
    if (member.userId === winnerUserId) continue;
    await sendPush(member.userId, {
      title: `${leagueName} winner declared`,
      body: `${winnerName} has won the league.`,
    });
  }
}

export async function notifyLeagueNoWinner(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });
  const leagueName = league?.name ?? "your league";

  const members = await prisma.leagueMember.findMany({
    where: { leagueId },
    select: { userId: true },
  });

  for (const member of members) {
    await sendPush(member.userId, {
      title: `${leagueName} completed`,
      body: "All remaining players were eliminated in the same gameweek. No winner this time.",
    });
  }
}
