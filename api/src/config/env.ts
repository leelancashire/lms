import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRY: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRY: z.string().min(1).default("7d"),

  FOOTBALL_DATA_ORG_API_KEY: z.string().optional(),
  FOOTBALL_DATA_ORG_BASE_URL: z.string().url().default("https://api.football-data.org/v4"),

  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z.string().url().default("https://v3.football.api-sports.io"),
  API_FOOTBALL_DAILY_LIMIT: z.coerce.number().int().positive().default(100),

  ODDS_API_KEY: z.string().optional(),
  ODDS_API_BASE_URL: z.string().url().default("https://api.the-odds-api.com/v4"),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),

  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_EMAILS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
