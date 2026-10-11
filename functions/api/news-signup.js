// POST /api/news-signup: the gamesquire.app form. Sends ONE confirmation email with a signed link and adds nobody to
// anything; /api/news-confirm does that when the link is tapped. Replaced the Formspree 1.0 waitlist on 2026-10-09.
//
// Abuse: the honeypot field answers "ok" and sends nothing. The same address gets at most one confirmation email per
// 10 minutes and one visitor (IP) at most 5, counted only for emails actually sent (Cloudflare's cache, per data
// centre, so best effort). It always answers ok for a valid address, so the form never reveals whether someone is
// already on the list.

import { cleanEmail, makeToken, resend } from '../_lib/news.js';

const COOLDOWN_SECONDS = 600;
const PER_VISITOR = 5;

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function cooldownEntry(key) {
  return new Request(`https://news-signup.cooldown/${encodeURIComponent(key)}`);
}

async function count(key) {
  const hit = await caches.default.match(cooldownEntry(key));
  return hit ? Number(await hit.text()) || 1 : 0;
}

async function remember(key, value) {
  await caches.default.put(
    cooldownEntry(key),
    new Response(String(value), { headers: { 'Cache-Control': `max-age=${COOLDOWN_SECONDS}` } }),
  );
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
  const sentHere = await count(`ip:${visitor}`);
  if ((await count(`email:${email}`)) > 0 || sentHere >= PER_VISITOR) return reply({ ok: true });

  const token = await makeToken(NEWS_SIGNUP_SECRET, email, Date.now());
  const link = `${new URL(request.url).origin}/api/news-confirm?t=${token}`;
  const res = await resend(RESEND_API_KEY, 'POST', '/emails', {
    from: 'GameSquire <support@squirebuilds.com>',
    to: email,
    subject: 'Confirm: GameSquire news',
    text:
      'Someone, hopefully you, asked to hear GameSquire news at this address.\n\n' +
      'Open this link and press the button to confirm. We will write a few times a year, by email or app notification, about new releases and what is new in ' +
      `GameSquire. Never ads.\n\n${link}\n\n` +
      'The link works for 7 days. If you did not ask, ignore this email and you will not hear from us again.\n\n' +
      'Vincent, GameSquire',
  });
  if (!res.ok) return reply({ error: 'send' }, 502);
  await remember(`email:${email}`, 1);
  await remember(`ip:${visitor}`, sentHere + 1);
  return reply({ ok: true });
}
