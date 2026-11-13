import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";
import {
  getAppSetting,
  setAppSetting,
  SETTING_EMAIL,
} from "@/lib/app-settings";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

const storedSmtpSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  tlsMode: z.enum(["tls", "starttls", "none"]),
  username: z.string().optional(),
  encryptedPassword: z.string().optional(),
  senderName: z.string().optional(),
  senderAddress: z.string().email(),
  replyTo: z.string().email().optional(),
});

export const smtpInputSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  tlsMode: z.enum(["tls", "starttls", "none"]),
  username: z.string().optional(),
  password: z.string().optional(),
  clearPassword: z.boolean().optional(),
  senderName: z.string().optional(),
  senderAddress: z.string().email(),
  replyTo: z.union([z.string().email(), z.literal("")]).optional(),
});

type StoredSmtp = z.infer<typeof storedSmtpSchema>;

export type ResolvedSmtp = {
  host: string;
  port: number;
  tlsMode: "tls" | "starttls" | "none";
  username?: string;
  password?: string;
  senderName?: string;
  senderAddress: string;
  replyTo?: string;
  source: "portal" | "env";
};

function envBoolean(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.toLowerCase() ?? "");
}

export async function getStoredSmtp() {
  const parsed = storedSmtpSchema.safeParse(
    await getAppSetting<unknown>(SETTING_EMAIL),
  );
  return parsed.success ? parsed.data : null;
}

export async function getSmtpPublicStatus() {
  const stored = await getStoredSmtp();
  const resolved = await resolveSmtpConfig().catch(() => null);
  return {
    configured: Boolean(resolved),
    source: resolved?.source ?? "none",
    host: stored?.host ?? process.env.SMTP_HOST ?? "",
    port:
      stored?.port ??
      Number(process.env.SMTP_PORT || (envBoolean(process.env.SMTP_SECURE) ? 465 : 587)),
    tlsMode:
      stored?.tlsMode ??
      (envBoolean(process.env.SMTP_SECURE) ? "tls" : "starttls"),
    username: stored?.username ?? process.env.SMTP_USER ?? "",
    passwordConfigured: Boolean(
      stored?.encryptedPassword ?? process.env.SMTP_PASSWORD,
    ),
    senderName: stored?.senderName ?? process.env.SMTP_FROM_NAME ?? "",
    senderAddress: stored?.senderAddress ?? process.env.SMTP_FROM ?? "",
    replyTo: stored?.replyTo ?? process.env.SMTP_REPLY_TO ?? "",
  };
}

export async function saveSmtpConfig(
  input: z.infer<typeof smtpInputSchema>,
) {
  const previous = await getStoredSmtp();
  let encryptedPassword = previous?.encryptedPassword;
  if (input.clearPassword) encryptedPassword = undefined;
  if (input.password?.trim()) {
    encryptedPassword = encryptSecret(input.password);
  }
  const stored: StoredSmtp = {
    host: input.host.trim(),
    port: input.port,
    tlsMode: input.tlsMode,
    username: input.username?.trim() || undefined,
    encryptedPassword,
    senderName: input.senderName?.trim() || undefined,
    senderAddress: input.senderAddress.trim().toLowerCase(),
    replyTo: input.replyTo?.trim().toLowerCase() || undefined,
  };
  await setAppSetting(SETTING_EMAIL, stored);
}

export async function resolveSmtpConfig(): Promise<ResolvedSmtp> {
  const stored = await getStoredSmtp();
  if (stored) {
    return {
      host: stored.host,
      port: stored.port,
      tlsMode: stored.tlsMode,
      username: stored.username,
      password: stored.encryptedPassword
        ? decryptSecret(stored.encryptedPassword)
        : undefined,
      senderName: stored.senderName,
      senderAddress: stored.senderAddress,
      replyTo: stored.replyTo,
      source: "portal",
    };
  }
  const host = process.env.SMTP_HOST?.trim();
  const senderAddress = process.env.SMTP_FROM?.trim();
  if (!host || !senderAddress) {
    throw new Error("SMTP is not configured");
  }
  const tlsMode =
    process.env.SMTP_TLS_MODE === "none"
      ? "none"
      : envBoolean(process.env.SMTP_SECURE)
        ? "tls"
        : "starttls";
  return {
    host,
    port: Number(process.env.SMTP_PORT || (tlsMode === "tls" ? 465 : 587)),
    tlsMode,
    username: process.env.SMTP_USER?.trim() || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    senderName: process.env.SMTP_FROM_NAME?.trim() || undefined,
    senderAddress,
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
    source: "env",
  };
}

export async function smtpTransport() {
  const config = await resolveSmtpConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.tlsMode === "tls",
    requireTLS: config.tlsMode === "starttls",
    ignoreTLS: config.tlsMode === "none",
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: config.username
      ? { user: config.username, pass: config.password ?? "" }
      : undefined,
  });
  return { transport, config };
}

export function formattedSender(config: ResolvedSmtp) {
  return config.senderName
    ? `"${config.senderName.replaceAll('"', "")}" <${config.senderAddress}>`
    : config.senderAddress;
}
