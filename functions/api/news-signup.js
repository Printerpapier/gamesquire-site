// POST /api/news-signup: the gamesquire.app form. Sends ONE confirmation email with a signed link and adds nobody to
// anything; /api/news-confirm does that when the link is tapped. Replaced the Formspree 1.0 waitlist on 2026-10-09.
//
// Abuse: the honeypot field answers "ok" and sends nothing, and the same address or the same visitor gets at most one
// confirmation email per 10 minutes (Cloudflare's cache, per data centre, so best effort). It always answers ok for
// a valid address, so the form never reveals whether someone is already on the list.

import { cleanEmail, makeToken, resend } from '../_lib/news.js';

const COOLDOWN_SECONDS = 600;

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function recentlyAsked(key) {
  const cache = caches.default;
  const entry = new Request(`https://news-signup.cooldown/${encodeURIComponent(key)}`);
  if (await cache.match(entry)) return true;
  await cache.put(entry, new Response('1', { headers: { 'Cache-Control': `max-age=${COOLDOWN_SECONDS}` } }));
  return false;
}

export async function onRequestPost({ request, env }) {
  const { RESEND_API_KEY, NEWS_SIGNUP_SECRET, RESEND_NEWS_SEGMENT_ID } = env;
  if (!RESEND_API_KEY || !NEWS_SIGNUP_SECRET || !RESEND_NEWS_SEGMENT_ID) return reply({ error: 'not configured' }, 503);

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply({ error: 'bad request' }, 400);
  }
  if (String(form.get('_gotcha') ?? '') !== '') return reply({ ok: true });
  const email = cleanEmail(form.get('email'));
  if (!email) return reply({ error: 'email' }, 400);

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if ((await recentlyAsked(`email:${email}`)) || (await recentlyAsked(`ip:${visitor}`))) return reply({ ok: true });

  const token = await makeToken(NEWS_SIGNUP_SECRET, email, Date.now());
  const link = `${new URL(request.url).origin}/api/news-confirm?t=${token}`;
  const res = await resend(RESEND_API_KEY, 'POST', '/emails', {
    from: 'GameSquire <support@squirebuilds.com>',
    to: email,
    subject: 'Confirm: GameSquire news',
    text:
      'Someone, hopefully you, asked to hear GameSquire news at this address.\n\n' +
      'Tap this link to confirm. We will write a few times a year about new releases and what is new in ' +
      `GameSquire. Never ads.\n\n${link}\n\n` +
      'The link works for 7 days. If you did not ask, ignore this email and you will not hear from us again.\n\n' +
      'Vincent, GameSquire',
  });
  if (!res.ok) return reply({ error: 'send' }, 502);
  return reply({ ok: true });
}
