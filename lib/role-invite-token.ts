import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function makeRoleToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashRoleToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function roleTokenHint(token: string) {
  return token.slice(-6);
}

export function verifyRoleToken(token: string, expectedHash: string) {
  const actual = Buffer.from(hashRoleToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}
