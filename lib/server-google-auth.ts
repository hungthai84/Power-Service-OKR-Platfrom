import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import firebaseConfig from '../firebase-applet-config.json';
import type { VerifiedSessionInfo } from '@/types/okr';

export const SESSION_COOKIE_NAME = 'flowokr_session';
const SESSION_TTL_SEC = 60 * 60 * 12; // 12 hours

// Process-scoped fallback secret if FLOWOKR_SESSION_SECRET is not provided in env
const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.FLOWOKR_SESSION_SECRET;
  if (envSecret && envSecret !== 'CHANGE_ME_IN_PRODUCTION' && envSecret.length >= 16) {
    return envSecret;
  }
  return RUNTIME_FALLBACK_SECRET;
}

interface CertCacheEntry {
  certs: Record<string, string>;
  expiresAt: number;
}

const certCache: Record<string, CertCacheEntry> = {};

async function fetchGoogleCerts(url: string): Promise<Record<string, string>> {
  const now = Date.now();
  const cached = certCache[url];
  if (cached && cached.expiresAt > now) {
    return cached.certs;
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Không thể tải chứng chỉ công khai xác thực Google.');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await res.json()) as Record<string, string>;

  certCache[url] = {
    certs,
    expiresAt: now + Math.max(60, maxAgeSec) * 1000,
  };
  return certs;
}

function decodeBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

/**
 * Cryptographically verifies a Firebase / Google Identity Services ID Token (RS256)
 * against Google's official X.509 certificates, issuer, audience, expiration, and email verification.
 */
export async function verifyGoogleCredential(idToken: string): Promise<VerifiedSessionInfo> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Thiếu Google ID Token để xác thực.');
  }
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Google ID Token không đúng định dạng JWT.');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(decodeBase64Url(headerB64).toString('utf8'));
    payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Không thể phân tích cấu trúc Google ID Token.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Thuật toán ký ID Token không hợp lệ.');
  }

  const iss = String(payload.iss || '');
  const aud = String(payload.aud || '');
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);
  const authTime = Number(payload.auth_time || iat || 0);

  if (!exp || exp <= nowSec) {
    throw new Error('Google ID Token đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (iat > nowSec + 300 || authTime > nowSec + 300) {
    throw new Error('Thời gian phát hành ID Token không hợp lệ.');
  }

  const firebaseProjectId = firebaseConfig.projectId;
  const expectedFirebaseIss = `https://securetoken.google.com/${firebaseProjectId}`;
  const validGisClientIds = [
    process.env.GOOGLE_CLIENT_ID,
    firebaseConfig.oAuthClientId,
  ].filter(Boolean) as string[];

  let certUrl = '';
  let resolvedGoogleSub = '';

  if (iss === expectedFirebaseIss && aud === firebaseProjectId) {
    certUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    // Prefer federated Google UID if present in firebase.identities['google.com'][0], else Firebase sub
    const firebaseClaim = payload.firebase as { identities?: Record<string, string[]> } | undefined;
    const googleIds = firebaseClaim?.identities?.['google.com'];
    resolvedGoogleSub = (googleIds && googleIds[0]) ? String(googleIds[0]) : String(payload.sub || '');
  } else if (
    (iss === 'https://accounts.google.com' || iss === 'accounts.google.com') &&
    validGisClientIds.includes(aud)
  ) {
    certUrl = 'https://www.googleapis.com/oauth2/v1/certs';
    resolvedGoogleSub = String(payload.sub || '');
  } else {
    throw new Error('Issuer hoặc Audience của Google ID Token không khớp cấu hình hệ thống.');
  }

  const certs = await fetchGoogleCerts(certUrl);
  const pem = certs[header.kid];
  if (!pem) {
    throw new Error('Không tìm thấy khóa công khai Google khớp với ID Token.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(pem, decodeBase64Url(sigB64));
  if (!signatureValid) {
    throw new Error('Chữ ký số của Google ID Token không hợp lệ.');
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const emailVerified = payload.email_verified === true;
  if (!resolvedGoogleSub || !email) {
    throw new Error('ID Token thiếu định danh Google sub hoặc email.');
  }
  if (!emailVerified) {
    throw new Error('Email Google chưa được xác minh (email_verified=false).');
  }

  return {
    googleSub: resolvedGoogleSub,
    email,
    emailVerified,
    fullName: String(payload.name || email.split('@')[0]),
    avatarUrl: String(payload.picture || ''),
  };
}

export interface SignedSessionPayload extends VerifiedSessionInfo {
  iat: number;
  exp: number;
}

export function createSessionToken(user: VerifiedSessionInfo): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = {
    ...user,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SignedSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!parsed.googleSub || !parsed.email || !parsed.emailVerified) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validateSession(req: NextRequest): SignedSessionPayload | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieToken) return null;
  return verifySessionToken(cookieToken);
}

export function setSessionCookie(res: NextResponse, user: VerifiedSessionInfo, isHttps: boolean) {
  const token = createSessionToken(user);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearSessionCookie(res: NextResponse, isHttps: boolean) {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 0,
  });
}

export function assertCsrfHeader(req: NextRequest): boolean {
  const csrf = req.headers.get('X-FlowOKR-CSRF');
  const origin = req.headers.get('Origin');
  const host = req.headers.get('Host');
  if (csrf !== '1') return false;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function isConfiguredAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAIL || process.env.ADMIN_EMAILS || '';
  if (!raw.trim()) return false;
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export async function checkDriveSpreadsheetOwnership(
  spreadsheetId: string,
  accessToken: string,
  verifiedEmail: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=owners(emailAddress,me)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { owners?: Array<{ emailAddress?: string; me?: boolean }> };
    const owners = data.owners || [];
    return owners.some(
      (o) =>
        o.me === true ||
        (o.emailAddress && o.emailAddress.trim().toLowerCase() === verifiedEmail.trim().toLowerCase())
    );
  } catch {
    return false;
  }
}

export function getGoogleAccessTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}
