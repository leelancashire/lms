import { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1).max(4096),
});

function signTokens(user: Pick<User, "id" | "email">) {
  const accessExpiresIn = env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"];
  const refreshExpiresIn = env.JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"];

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, type: "access" as const },
    env.JWT_SECRET,
    { expiresIn: accessExpiresIn }
  );

  const refreshToken = jwt.sign({ sub: user.id, type: "refresh" as const }, env.JWT_SECRET, {
    expiresIn: refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    fcmToken: user.fcmToken,
    createdAt: user.createdAt,
  };
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      displayName: parsed.data.displayName,
      passwordHash,
    },
  });

  const tokens = signTokens(user);

  return res.status(201).json({ user: toPublicUser(user), ...tokens });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const tokens = signTokens(user);

  return res.json({ user: toPublicUser(user), ...tokens });
});

router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const decoded = jwt.verify(parsed.data.refreshToken, env.JWT_SECRET) as {
      sub: string;
      type: "access" | "refresh";
    };

    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const tokens = signTokens(user);
    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user: toPublicUser(user) });
});

router.put("/fcm-token", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = fcmTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: parsed.data.fcmToken },
  });

  return res.json({ success: true });
});

export default router;
