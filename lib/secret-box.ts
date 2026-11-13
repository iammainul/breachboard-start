import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required to store portal secrets");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decodePart(part: string) {
  const buf = Buffer.from(part, "base64url");
  // Reject empty or non-canonical encodings (unused trailing bits, padding flips).
  if (buf.length === 0 || buf.toString("base64url") !== part) {
    throw new Error("Stored secret is unreadable");
  }
  return buf;
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Stored secret is unreadable");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    decodePart(iv),
  );
  decipher.setAuthTag(decodePart(tag));
  return Buffer.concat([
    decipher.update(decodePart(encrypted)),
    decipher.final(),
  ]).toString("utf8");
}
