import { LeagueStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getCurrentGameweekInfo } from "../utils/gameweek";

const router = Router();
router.use(authMiddleware);

const createLeagueBody = z.object({
  name: z.string().min(1).max(100),
  isPublic: z.boolean().optional().default(false),
});

const leagueIdParams = z.object({
  id: z.string().min(1),
});

const joinLeagueBody = z.object({
  code: z.string().trim().toUpperCase().length(6),
});
const previewQuery = z.object({
  code: z.string().trim().toUpperCase().length(6),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateInviteCode();
    const exists = await prisma.league.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Unable to generate unique invite code");
}

router.post("/", validate({ body: createLeagueBody }), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { name, isPublic } = req.body as z.infer<typeof createLeagueBody>;
  const code = await createUniqueInviteCode();

  const league = await prisma.$transaction(async (tx) => {
    const created = await tx.league.create({
      data: {
        name,
        isPublic,
        code,
        creatorId: userId,
      },
    });

    await tx.leagueMember.create({
      data: {
        leagueId: created.id,
        userId,
      },
    });

    return created;
  });

  return res.status(201).json({ league });
});

router.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const memberships = await prisma.leagueMember.findMany({
    where: { userId },
    include: {
      league: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const leagueIds = memberships.map((m) => m.league.id);
  const aliveCounts = leagueIds.length
    ? await prisma.leagueMember.groupBy({
        by: ["leagueId"],
        where: {
          leagueId: { in: leagueIds },
          status: { in: ["ALIVE", "WINNER"] },
        },
        _count: { _all: true },
      })
    : [];
  const aliveCountByLeague = new Map(aliveCounts.map((item) => [item.leagueId, item._count._all]));

  const leagues = memberships.map((m) => ({
    id: m.league.id,
    name: m.league.name,
    code: m.league.code,
    season: m.league.season,
    competition: m.league.competition,
    isPublic: m.league.isPublic,
    status: m.league.status,
    creatorId: m.league.creatorId,
    createdAt: m.league.createdAt,
    memberCount: m.league._count.members,
    aliveCount: aliveCountByLeague.get(m.league.id) ?? 0,
    myStatus: m.status,
    joinedAt: m.joinedAt,
  }));

  return res.json({ leagues });
});

router.get("/public", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const leagues = await prisma.league.findMany({
    where: {
      isPublic: true,
      status: LeagueStatus.ACTIVE,
      members: {
        none: { userId },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({
    leagues: leagues.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      season: l.season,
      competition: l.competition,
      isPublic: l.isPublic,
      status: l.status,
      creatorId: l.creatorId,
      createdAt: l.createdAt,
      memberCount: l._count.members,
    })),
  });
});

router.get("/preview", validate({ query: previewQuery }), async (req, res) => {
  const { code } = req.query as z.infer<typeof previewQuery>;

  const league = await prisma.league.findUnique({
    where: { code },
    include: { _count: { select: { members: true } } },
  });

  if (!league) {
    return res.status(404).json({ error: "League not found" });
  }

  return res.json({
    league: {
      id: league.id,
      name: league.name,
      code: league.code,
      status: league.status,
      isPublic: league.isPublic,
      memberCount: league._count.members,
    },
  });
});

router.get("/:id", validate({ params: leagueIdParams }), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params as z.infer<typeof leagueIdParams>;

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: id, userId } },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this league" });
  }

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, displayName: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { picks: true, members: true } },
    },
  });

  if (!league) {
    return res.status(404).json({ error: "League not found" });
  }

  const pickCounts = await prisma.pick.groupBy({
    by: ["userId"],
    where: { leagueId: id },
    _count: { _all: true },
  });
  const pickCountMap = new Map<string, number>(pickCounts.map((p) => [p.userId, p._count._all]));

  const members = league.members.map((m) => ({
    id: m.id,
    user: m.user,
    status: m.status,
    eliminatedGameweek: m.eliminatedGameweek,
    joinedAt: m.joinedAt,
    pickCount: pickCountMap.get(m.userId) ?? 0,
  }));

  const currentGameweek = await getCurrentGameweekInfo();

  return res.json({
    league: {
      id: league.id,
      name: league.name,
      code: league.code,
      season: league.season,
      competition: league.competition,
      isPublic: league.isPublic,
      status: league.status,
      creatorId: league.creatorId,
      creator: league.creator,
      createdAt: league.createdAt,
      memberCount: league._count.members,
      pickCount: league._count.picks,
    },
    members,
    currentGameweek,
  });
});

router.post(
  "/:id/join",
  validate({ params: leagueIdParams, body: joinLeagueBody }),
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params as z.infer<typeof leagueIdParams>;
    const { code } = req.body as z.infer<typeof joinLeagueBody>;

    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: "League not found" });

    if (league.status === LeagueStatus.COMPLETED) {
      return res.status(400).json({ error: "League is completed" });
    }

    if (league.code !== code) {
      return res.status(400).json({ error: "Invalid invite code" });
    }

    const existing = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: id, userId } },
    });

    if (existing) {
      return res.status(409).json({ error: "User is already a member" });
    }

    const membership = await prisma.leagueMember.create({
      data: {
        leagueId: id,
        userId,
      },
    });

    return res.status(201).json({ membership });
  }
);

router.delete("/:id/leave", validate({ params: leagueIdParams }), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params as z.infer<typeof leagueIdParams>;

  const league = await prisma.league.findUnique({ where: { id } });
  if (!league) return res.status(404).json({ error: "League not found" });

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: id, userId } },
  });

  if (!membership) {
    return res.status(404).json({ error: "Membership not found" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueMember.delete({ where: { id: membership.id } });

    if (league.creatorId !== userId) {
      return;
    }

    const remainingMembers = await tx.leagueMember.findMany({
      where: { leagueId: id },
      orderBy: { joinedAt: "asc" },
      select: { userId: true },
    });

    if (remainingMembers.length === 0) {
      await tx.pick.deleteMany({ where: { leagueId: id } });
      await tx.league.delete({ where: { id } });
      return;
    }

    await tx.league.update({
      where: { id },
      data: { creatorId: remainingMembers[0].userId },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return res.json({ success: true });
});

export default router;
