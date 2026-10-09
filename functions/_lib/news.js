// Shared by /api/news-signup and /api/news-confirm: the gamesquire.app "News and new releases" list, with a double
// opt-in. Nobody is on the list until they tap the link in the confirmation email. The app's own switch fills the
// same Resend segment (GameSquire repo, docs/news-opt-in.md, read it before changing this).
//
// Pages secrets (Settings, Variables and Secrets, Production): RESEND_API_KEY, RESEND_NEWS_SEGMENT_ID and
// NEWS_SIGNUP_SECRET (any long random text; it signs the confirmation links).

export const LINK_DAYS = 7;
const RESEND = 'https://api.resend.com';

function b64url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

// A link token is "<base64url(email|asked-at-ms)>.<signature>". Signed, so nobody can confirm an address whose inbox
// they cannot read.
export async function makeToken(secret, email, askedAt) {
  const body = b64url(new TextEncoder().encode(`${email}|${askedAt}`));
  return `${body}.${await hmac(secret, body)}`;
}

// Returns { email, askedAt } or null for a forged, broken or expired link.
export async function readToken(secret, token) {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = await hmac(secret, body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  let parts;
  try {
    parts = fromB64url(body).split('|');
  } catch {
    return null;
  }
  const email = parts[0];
  const askedAt = Number(parts[1]);
  if (!email || !Number.isFinite(askedAt) || Date.now() - askedAt > LINK_DAYS * 86400000) return null;
  return { email, askedAt };
}

export function cleanEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// One retry after a second on a rate limit or a server error.
export async function resend(key, method, path, body) {
  const send = () =>
    fetch(`${RESEND}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const first = await send();
  if (first.status !== 429 && first.status < 500) return first;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return send();
}
