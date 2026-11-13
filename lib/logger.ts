import pino from "pino";

const REDACT_PATHS = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "email",
  "totp",
  "totpSecret",
  "body",
  "DATABASE_URL",
  "AUTH_SECRET",
  "OPERATOR_PASSWORD",
  "OPERATOR_EMAIL",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "CURSOR_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "NVD_API_KEY",
  "RETENTION_CRON_SECRET",
  "CRON_SECRET",
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.authorization",
  "*.cookie",
  "*.email",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

function logLevel(): string {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      name: "breachboard",
      level: logLevel(),
      redact: {
        paths: REDACT_PATHS,
        censor: "[Redacted]",
      },
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export const logger = createLogger();

export function logError(message: string, err: unknown, extra?: Record<string, unknown>) {
  const error =
    err instanceof Error
      ? { name: err.name, message: err.message }
      : { message: String(err) };
  logger.error({ ...extra, err: error }, message);
}

/** Authz/rate-limit/CSRF events. Callers must not pass email, names, tokens, or bodies. */
export function logSecurityEvent(
  event: string,
  extra?: { code?: string; bucket?: string; route?: string; status?: number },
) {
  logger.warn({ event, ...extra }, event);
}
