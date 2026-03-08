import { describe, expect, it } from "vitest";
import { submitPickInTransaction } from "../src/services/picks";
import { HttpError } from "../src/utils/httpError";

function makeTx(overrides: Record<string, unknown> = {}) {
  const base = {
    leagueMember: {
      findUnique: async () => ({ id: "m1", status: "ALIVE" }),
    },
    fixture: {
      groupBy: async () => [
        {
          gameweek: 10,
          _min: { kickoffTime: new Date("2026-03-20T12:00:00.000Z") },
          _max: { kickoffTime: new Date("2026-03-22T17:00:00.000Z") },
        },
      ],
      findFirst: async () => ({ kickoffTime: new Date("2026-03-20T15:00:00.000Z") }),
    },
    pick: {
      upsert: async () => ({ id: "p1", team: { id: 57 }, gameweek: 10 }),
    },
  };

  return {
    ...base,
    ...overrides,
    leagueMember: { ...base.leagueMember, ...(overrides.leagueMember as object) },
    fixture: { ...base.fixture, ...(overrides.fixture as object) },
    pick: { ...base.pick, ...(overrides.pick as object) },
  } as any;
}

describe("submitPickInTransaction", () => {
  it("rejects used team via unique constraint", async () => {
    const tx = makeTx({
      pick: {
        upsert: async () => {
          throw { code: "P2002" };
        },
      },
    });

    await expect(
      submitPickInTransaction(tx, {
        leagueId: "l1",
        userId: "u1",
        teamId: 57,
        now: new Date("2026-03-20T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({ status: 409, message: "Team already used in this league" });
  });

  it("rejects when no open gameweek is available", async () => {
    const tx = makeTx();

    await expect(
      submitPickInTransaction(tx, {
        leagueId: "l1",
        userId: "u1",
        teamId: 57,
        now: new Date("2026-03-20T12:00:00.000Z"),
      })
    ).rejects.toMatchObject({ status: 400, message: "No open gameweek available" });
  });

  it("rejects when team is not playing in the gameweek", async () => {
    const tx = makeTx({
      fixture: {
        findFirst: async () => null,
      },
    });

    await expect(
      submitPickInTransaction(tx, {
        leagueId: "l1",
        userId: "u1",
        teamId: 57,
        now: new Date("2026-03-20T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({ status: 400, message: "Selected team is not playing in this gameweek" });
  });

  it("creates/upserts pick successfully", async () => {
    const tx = makeTx();

    const result = await submitPickInTransaction(tx, {
      leagueId: "l1",
      userId: "u1",
      teamId: 57,
      now: new Date("2026-03-20T11:00:00.000Z"),
    });

    expect(result.pick.id).toBe("p1");
    expect(result.gameweek).toBe(10);
    expect(result.deadline.toISOString()).toBe("2026-03-20T12:00:00.000Z");
  });
});
