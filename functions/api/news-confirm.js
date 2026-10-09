// GET /api/news-confirm?t=...: the link in the confirmation email. Puts the address in the Resend "News" segment,
// subscribed, with consent_source = gamesquire.app and consent_at = when the link was tapped, then shows a page.
// The same list the app's switch fills (GameSquire repo, docs/news-opt-in.md).

import { readToken, resend } from '../_lib/news.js';

function go(request, page) {
  return Response.redirect(`${new URL(request.url).origin}/${page}`, 303);
}

export async function onRequestGet({ request, env }) {
  const { RESEND_API_KEY, RESEND_NEWS_SEGMENT_ID, NEWS_SIGNUP_SECRET } = env;
  if (!RESEND_API_KEY || !RESEND_NEWS_SEGMENT_ID || !NEWS_SIGNUP_SECRET) return go(request, 'news-link');

  const token = await readToken(NEWS_SIGNUP_SECRET, new URL(request.url).searchParams.get('t'));
  if (!token) return go(request, 'news-link');
  const contact = encodeURIComponent(token.email);

  // An existing contact (from the app, or an earlier signup) is re-subscribed: tapping the link is fresh consent.
  const update = await resend(RESEND_API_KEY, 'PATCH', `/contacts/${contact}`, { unsubscribed: false });
  if (update.status === 404) {
    const created = await resend(RESEND_API_KEY, 'POST', '/contacts', {
      email: token.email,
      unsubscribed: false,
      segments: [{ id: RESEND_NEWS_SEGMENT_ID }],
    });
    if (!created.ok) return go(request, 'news-link');
  } else if (update.ok) {
    const added = await resend(RESEND_API_KEY, 'POST', `/contacts/${contact}/segments/${RESEND_NEWS_SEGMENT_ID}`);
    if (!added.ok && added.status !== 409) return go(request, 'news-link');
  } else {
    return go(request, 'news-link');
  }
  // The consent record. Best effort: membership above is what matters, and a missing property never undoes it.
  await resend(RESEND_API_KEY, 'PATCH', `/contacts/${contact}`, {
    properties: { consent_source: 'gamesquire.app', consent_at: new Date().toISOString() },
  }).catch(() => null);
  return go(request, 'news-confirmed');
}
