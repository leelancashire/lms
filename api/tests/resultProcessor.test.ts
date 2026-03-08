import { describe, expect, it } from "vitest";
import { processGameweekResults } from "../src/services/resultProcessor";

type MemberStatus = "ALIVE" | "ELIMINATED" | "WINNER";
type LeagueStatus = "ACTIVE" | "COMPLETED";
type PickResult = "PENDING" | "WON" | "LOST" | "DRAWN";
type FixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";

interface FixtureRow {
  id: string;
  gameweek: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: FixtureStatus;
  kickoffTime: Date;
}

interface LeagueRow {
  id: string;
  status: LeagueStatus;
}

interface MemberRow {
  id: string;
  leagueId: string;
  userId: string;
  status: MemberStatus;
  eliminatedGameweek: number | null;
  joinedAt: Date;
}

interface PickRow {
  id: string;
  leagueId: string;
  userId: string;
  gameweek: number;
  teamId: number;
  result: PickResult;
}

function makeDb(state: {
  fixtures: FixtureRow[];
  leagues: LeagueRow[];
  members: MemberRow[];
  picks: PickRow[];
}) {
  return {
    fixture: {
      async findMany(args: { where: { gameweek: number } }) {
        return state.fixtures
          .filter((f) => f.gameweek === args.where.gameweek)
          .sort((a, b) => a.kickoffTime.getTime() - b.kickoffTime.getTime());
      },
    },
    league: {
      async findMany() {
        return state.leagues.filter((l) => l.status === "ACTIVE").map((l) => ({ id: l.id }));
      },
      async update(args: { where: { id: string }; data: { status: "COMPLETED" } }) {
        const league = state.leagues.find((l) => l.id === args.where.id);
        if (league) league.status = args.data.status;
        return league;
      },
    },
    leagueMember: {
      async findMany(args: { where: { leagueId: string; status?: "ALIVE" } }) {
        return state.members.filter(
          (m) => m.leagueId === args.where.leagueId && (!args.where.status || m.status === args.where.status)
        );
      },
      async update(args: {
        where: { id: string };
        data: { status: "ELIMINATED" | "WINNER"; eliminatedGameweek?: number | null };
      }) {
        const member = state.members.find((m) => m.id === args.where.id);
        if (member) {
          member.status = args.data.status;
          if (Object.prototype.hasOwnProperty.call(args.data, "eliminatedGameweek")) {
            member.eliminatedGameweek = args.data.eliminatedGameweek ?? null;
          }
        }
        return member;
      },
    },
    pick: {
      async findUnique(args: { where: { leagueId_userId_gameweek: { leagueId: string; userId: string; gameweek: number } } }) {
        const k = args.where.leagueId_userId_gameweek;
        const pick = state.picks.find((p) => p.leagueId === k.leagueId && p.userId === k.userId && p.gameweek === k.gameweek);
        return pick ? { id: pick.id, teamId: pick.teamId } : null;
      },
      async update(args: { where: { id: string }; data: { result: PickResult } }) {
        const pick = state.picks.find((p) => p.id === args.where.id);
        if (pick) pick.result = args.data.result;
        return pick;
      },
    },
  };
}

const noopNotifier = {
  eliminated: async () => {},
  survived: async () => {},
  leagueWinner: async () => {},
};

function baseState() {
  return {
    fixtures: [
      {
        id: "fx1",
        gameweek: 1,
        homeTeamId: 57,
        awayTeamId: 58,
        homeScore: 2,
        awayScore: 1,
        status: "FINISHED" as FixtureStatus,
        kickoffTime: new Date("2026-08-15T12:00:00.000Z"),
      },
      {
        id: "fx2",
        gameweek: 1,
        homeTeamId: 61,
        awayTeamId: 62,
        homeScore: 0,
        awayScore: 0,
        status: "FINISHED" as FixtureStatus,
        kickoffTime: new Date("2026-08-15T15:00:00.000Z"),
      },
    ],
    leagues: [{ id: "l1", status: "ACTIVE" as LeagueStatus }],
    members: [
      {
        id: "m1",
        leagueId: "l1",
        userId: "u1",
        status: "ALIVE" as MemberStatus,
        eliminatedGameweek: null,
        joinedAt: new Date("2026-08-01T10:00:00.000Z"),
      },
      {
        id: "m2",
        leagueId: "l1",
        userId: "u2",
        status: "ALIVE" as MemberStatus,
        eliminatedGameweek: null,
        joinedAt: new Date("2026-08-01T10:00:00.000Z"),
      },
    ],
    picks: [
      { id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 57, result: "PENDING" as PickResult },
      { id: "p2", leagueId: "l1", userId: "u2", gameweek: 1, teamId: 58, result: "PENDING" as PickResult },
    ],
  };
}

describe("processGameweekResults", () => {
  it("team wins => survive", async () => {
    const state = baseState();
    state.picks = [{ id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 57, result: "PENDING" }];
    state.members = [{
      id: "m1",
      leagueId: "l1",
      userId: "u1",
      status: "ALIVE",
      eliminatedGameweek: null,
      joinedAt: new Date("2026-08-01T10:00:00.000Z"),
    }];

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.picks[0].result).toBe("WON");
    expect(state.members[0].status).toBe("WINNER");
    expect(state.leagues[0].status).toBe("COMPLETED");
  });

  it("team loses => eliminated", async () => {
    const state = baseState();

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.picks.find((p) => p.id === "p2")?.result).toBe("LOST");
    expect(state.members.find((m) => m.id === "m2")?.status).toBe("ELIMINATED");
    expect(state.members.find((m) => m.id === "m2")?.eliminatedGameweek).toBe(1);
  });

  it("team draws => eliminated", async () => {
    const state = baseState();
    state.picks = [{ id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 61, result: "PENDING" }];
    state.members = [{
      id: "m1",
      leagueId: "l1",
      userId: "u1",
      status: "ALIVE",
      eliminatedGameweek: null,
      joinedAt: new Date("2026-08-01T10:00:00.000Z"),
    }];

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.picks[0].result).toBe("DRAWN");
    expect(state.members[0].status).toBe("ELIMINATED");
    expect(state.leagues[0].status).toBe("COMPLETED");
  });

  it("no pick submitted => eliminated", async () => {
    const state = baseState();
    state.picks = [{ id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 57, result: "PENDING" }];

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.members.find((m) => m.userId === "u2")?.status).toBe("ELIMINATED");
    expect(state.members.find((m) => m.userId === "u2")?.eliminatedGameweek).toBe(1);
  });

  it("new joiner after round start with no pick => survives and waits for next round", async () => {
    const state = baseState();
    state.picks = [{ id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 57, result: "PENDING" }];
    const lateJoiner = state.members.find((m) => m.userId === "u2");
    if (!lateJoiner) throw new Error("late joiner missing in test state");
    lateJoiner.joinedAt = new Date("2026-08-15T12:10:00.000Z");

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.members.find((m) => m.userId === "u2")?.status).toBe("ALIVE");
    expect(state.members.find((m) => m.userId === "u2")?.eliminatedGameweek).toBeNull();
  });

  it("postponed match => survive", async () => {
    const state = baseState();
    state.fixtures[0].status = "POSTPONED";
    state.fixtures[0].homeScore = null;
    state.fixtures[0].awayScore = null;
    state.fixtures[1].status = "POSTPONED";
    state.fixtures[1].homeScore = null;
    state.fixtures[1].awayScore = null;

    state.picks = [{ id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 57, result: "PENDING" }];
    state.members = [{ id: "m1", leagueId: "l1", userId: "u1", status: "ALIVE", eliminatedGameweek: null }];

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.picks[0].result).toBe("WON");
    expect(state.members[0].status).toBe("WINNER");
  });

  it("all remaining players eliminated same GW => no winner", async () => {
    const state = baseState();
    state.picks = [
      { id: "p1", leagueId: "l1", userId: "u1", gameweek: 1, teamId: 58, result: "PENDING" },
      { id: "p2", leagueId: "l1", userId: "u2", gameweek: 1, teamId: 61, result: "PENDING" },
    ];

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.members.every((m) => m.status === "ELIMINATED")).toBe(true);
    expect(state.leagues[0].status).toBe("COMPLETED");
  });

  it("exactly one survivor => winner declared", async () => {
    const state = baseState();

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.members.find((m) => m.userId === "u1")?.status).toBe("WINNER");
    expect(state.leagues[0].status).toBe("COMPLETED");
  });

  it("last-two-standing one loses one wins => winner declared", async () => {
    const state = baseState();

    await processGameweekResults(1, makeDb(state) as any, noopNotifier);

    expect(state.picks.find((p) => p.userId === "u1")?.result).toBe("WON");
    expect(state.picks.find((p) => p.userId === "u2")?.result).toBe("LOST");
    expect(state.members.find((m) => m.userId === "u1")?.status).toBe("WINNER");
    expect(state.members.find((m) => m.userId === "u2")?.status).toBe("ELIMINATED");
    expect(state.leagues[0].status).toBe("COMPLETED");
  });
});
