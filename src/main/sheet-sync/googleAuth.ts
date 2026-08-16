import fs from 'node:fs';
import { createSign } from 'node:crypto';

// Service-account auth without googleapis: sign a JWT with the key's RS256
// private key and exchange it for a short-lived access token. Keeps the
// dependency tree clean — native-module packaging here is already delicate.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function readServiceAccountKey(keyPath: string): ServiceAccountKey {
  if (!keyPath) {
    throw new Error('No service-account key configured. Pick the key JSON file in the sync settings.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read service-account key at ${keyPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new Error('The selected file is not a Google service-account key (missing client_email/private_key).');
  }
  return key as ServiceAccountKey;
}

let cached: { token: string; expiresAt: number; keyPath: string } | null = null;

export async function getAccessToken(keyPath: string): Promise<string> {
  const now = Date.now();
  if (cached && cached.keyPath === keyPath && now < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const key = readServiceAccountKey(keyPath);
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString('base64url');
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google auth failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  cached = { token: body.access_token, expiresAt: now + 3600_000, keyPath };
  return body.access_token;
}
