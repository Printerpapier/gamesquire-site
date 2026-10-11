// /api/news-confirm: the link in the confirmation email. Two steps, so a mail filter that opens every link (Outlook
// Safe Links, Defender, Proofpoint) cannot sign someone up on its own:
//   GET  ?t=...  checks the link and shows news-confirm.html with a "Yes, send me news" button. Changes nothing.
//   POST t=...   the button. Puts the address in the Resend "News" segment, subscribed, with
//                consent_source = gamesquire.app and consent_at = now, then shows news-confirmed.
// A bad or expired link goes to news-link; a failure on our side (configuration, Resend) to news-error, so a good
// link is never blamed. The same list the app's switch fills (GameSquire repo, docs/news-opt-in.md).

import { readToken, resend } from '../_lib/news.js';

function go(request, page) {
  return Response.redirect(`${new URL(request.url).origin}/${page}`, 303);
}

function configured(env) {
  return !!(env.RESEND_API_KEY && env.RESEND_NEWS_SEGMENT_ID && env.NEWS_SIGNUP_SECRET);
}

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return go(request, 'news-error');
  const raw = new URL(request.url).searchParams.get('t') ?? '';
  if (!(await readToken(env.NEWS_SIGNUP_SECRET, raw))) return go(request, 'news-link');
  // The token is base64url plus a dot (readToken just verified its signature), so it is safe inside the attribute.
  const page = await env.ASSETS.fetch(new URL('/news-confirm', request.url));
  if (!page.ok) return go(request, 'news-error');
  const html = (await page.text()).replace('__NEWS_TOKEN__', raw);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const { RESEND_API_KEY, RESEND_NEWS_SEGMENT_ID, NEWS_SIGNUP_SECRET } = env;
  if (!configured(env)) return go(request, 'news-error');

  let form;
  try {
    form = await request.formData();
  } catch {
    return go(request, 'news-link');
  }
  const token = await readToken(NEWS_SIGNUP_SECRET, form.get('t'));
  if (!token) return go(request, 'news-link');
  const contact = encodeURIComponent(token.email);

  // An existing contact (from the app, or an earlier signup) is re-subscribed: pressing the button is fresh consent.
  const update = await resend(RESEND_API_KEY, 'PATCH', `/contacts/${contact}`, { unsubscribed: false });
  if (update.status === 404) {
    const created = await resend(RESEND_API_KEY, 'POST', '/contacts', {
      email: token.email,
      unsubscribed: false,
      segments: [{ id: RESEND_NEWS_SEGMENT_ID }],
    });
    if (!created.ok) return go(request, 'news-error');
  } else if (update.ok) {
    const added = await resend(RESEND_API_KEY, 'POST', `/contacts/${contact}/segments/${RESEND_NEWS_SEGMENT_ID}`);
    if (!added.ok && added.status !== 409) return go(request, 'news-error');
  } else {
    return go(request, 'news-error');
  }
  // The consent record. Best effort: membership above is what matters, and a missing property never undoes it.
  await resend(RESEND_API_KEY, 'PATCH', `/contacts/${contact}`, {
    properties: { consent_source: 'gamesquire.app', consent_at: new Date().toISOString() },
  }).catch(() => null);
  return go(request, 'news-confirmed');
}
