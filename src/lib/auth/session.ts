import { SESSION_MAX_AGE_SECONDS } from "./constants";

function getAuthSecret(): string {
  return (
    process.env.DASHBOARD_AUTH_SECRET?.trim() ||
    process.env.DASHBOARD_PASSWORD?.trim() ||
    ""
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getSecretKey(): Promise<CryptoKey> {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("Auth secret not configured");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD?.trim());
}

export async function createSessionToken(): Promise<string> {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  );
  const key = await getSecretKey();
  const signature = await crypto.subtle.sign("HMAC", key, payload);
  return `${toBase64Url(payload)}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) {
      return false;
    }

    const payload = fromBase64Url(payloadPart);
    const signature = fromBase64Url(signaturePart);
    const key = await getSecretKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as BufferSource,
      payload as unknown as BufferSource,
    );

    if (!valid) {
      return false;
    }

    const parsed = JSON.parse(new TextDecoder().decode(payload)) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}