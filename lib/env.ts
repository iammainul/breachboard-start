import { z } from "zod";

/** Name passed to `prisma migrate resolve --applied` for db-push databases. */
export const BASELINE_MIGRATION = "20261009120000_baseline";

const PLACEHOLDER_SECRETS = new Set([
  "replace-with-a-long-random-string",
  "dev-docker-auth-secret-change-me",
  "ci-auth-secret-not-for-production",
  "build-time-secret",
  "change-me",
]);

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (value == null || value === "") return false;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
  });

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  ),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: optionalString,
  OPERATOR_EMAIL: optionalString,
  OPERATOR_PASSWORD: z.string().optional(),
  MEDIA_ROOT: optionalString,
  PORT: optionalString,
  HOSTNAME: optionalString,
  ALLOW_DEV_DEFAULTS: booleanish,
  SEED_DEMO: booleanish,
  AUTO_ONBOARD_INTEL: optionalString,
  LLM_PROVIDER: optionalString,
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GITHUB_TOKEN: optionalString,
  CURSOR_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  NVD_API_KEY: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PASSWORD: optionalString,
  /** In-app IRP/CCMP hard-delete interval (ms). Min 60000. Unset = off. */
  DOCUMENT_RETENTION_SWEEP_MS: optionalString,
  /** Bearer / x-retention-secret for POST|GET /api/internal/retention/run. */
  RETENTION_CRON_SECRET: optionalString,
  /** Alias for RETENTION_CRON_SECRET. */
  CRON_SECRET: optionalString,
  /** In-memory limiter store id. Only `memory` is implemented. */
  RATE_LIMIT_STORE: optionalString,
  RATE_LIMIT_LOGIN_MAX: optionalString,
  RATE_LIMIT_JOIN_MAX: optionalString,
  RATE_LIMIT_JOIN_IP_MAX: optionalString,
  RATE_LIMIT_INVITE_MAX: optionalString,
  RATE_LIMIT_ANSWER_MAX: optionalString,
  RATE_LIMIT_RETENTION_MAX: optionalString,
});

export type AppEnv = z.infer<typeof envSchema>;

export type EnvIssue = { path: string; message: string };

export function isBuildPhase(env: NodeJS.ProcessEnv = process.env): boolean {
  const phase = env.NEXT_PHASE ?? "";
  return (
    phase === "phase-production-build" ||
    phase === "phase-development-build" ||
    env.npm_lifecycle_event === "build"
  );
}

export function isStrictProduction(env: AppEnv): boolean {
  return env.NODE_ENV === "production" && !env.ALLOW_DEV_DEFAULTS;
}

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value) return true;
  return PLACEHOLDER_SECRETS.has(value.trim());
}

function extraProductionIssues(env: AppEnv): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (env.AUTH_SECRET.length < 32) {
    issues.push({
      path: "AUTH_SECRET",
      message: "must be at least 32 characters in production",
    });
  }
  if (isPlaceholderSecret(env.AUTH_SECRET)) {
    issues.push({
      path: "AUTH_SECRET",
      message: "is a known placeholder; generate a unique secret before production",
    });
  }
  if (!env.AUTH_URL) {
    issues.push({
      path: "AUTH_URL",
      message: "is required in production (public origin, e.g. https://ttx.example.com)",
    });
  }
  if (!env.OPERATOR_EMAIL) {
    issues.push({
      path: "OPERATOR_EMAIL",
      message: "is required to bootstrap the first admin user",
    });
  }
  if (!env.OPERATOR_PASSWORD || isPlaceholderSecret(env.OPERATOR_PASSWORD)) {
    issues.push({
      path: "OPERATOR_PASSWORD",
      message: "must be set to a non-placeholder value in production",
    });
  }
  return issues;
}

export function parseEnv(
  source: NodeJS.ProcessEnv = process.env,
): { env: AppEnv; issues: EnvIssue[] } {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return {
      env: undefined as unknown as AppEnv,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  const issues = isStrictProduction(parsed.data)
    ? extraProductionIssues(parsed.data)
    : [];
  return { env: parsed.data, issues };
}

export function formatEnvIssues(issues: EnvIssue[]): string {
  const lines = [
    "Invalid environment configuration:",
    ...issues.map((issue) => `  - ${issue.path}: ${issue.message}`),
    "Set the variables in `.env` / `.env.local` (see `.env.example` and docs/DEPLOY.md). Values are not printed.",
  ];
  return lines.join("\n");
}

/**
 * Fail fast in production runtimes. Skipped during `next build`, tests, and
 * `ALLOW_DEV_DEFAULTS=true` (local `./run.sh docker`).
 */
export function assertRuntimeEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const skipStrict = source.NODE_ENV === "test" || isBuildPhase(source);
  const filled: NodeJS.ProcessEnv = skipStrict
    ? {
        ...source,
        DATABASE_URL:
          source.DATABASE_URL ?? "postgresql://ttx:ttx@127.0.0.1:5432/ttx",
        AUTH_SECRET: source.AUTH_SECRET ?? "test-only-secret-that-is-long-enough",
        NODE_ENV:
          source.NODE_ENV ?? (isBuildPhase(source) ? "production" : "test"),
        ALLOW_DEV_DEFAULTS: source.ALLOW_DEV_DEFAULTS ?? "true",
      }
    : source;

  const { env, issues } = parseEnv(filled);
  if (skipStrict) {
    if (issues.length === 0) return env;
    return {
      NODE_ENV: (filled.NODE_ENV as AppEnv["NODE_ENV"]) ?? "test",
      DATABASE_URL: filled.DATABASE_URL ?? "postgresql://ttx:ttx@127.0.0.1:5432/ttx",
      AUTH_SECRET: filled.AUTH_SECRET ?? "test-only-secret-that-is-long-enough",
      ALLOW_DEV_DEFAULTS: true,
      SEED_DEMO: false,
    } as AppEnv;
  }

  if (issues.length > 0) {
    const message = formatEnvIssues(issues);
    console.error(message);
    throw new Error(message);
  }
  return env;
}
