/* Fills in the handle on /u/<username>.
 *
 * THE RULE THIS FILE IS BUILT AROUND: it reads the name out of the URL and never asks anything
 * whether that person exists. The app's own lookup is deliberately an exact match behind a signed-in
 * session, so that nobody can fish for usernames; a public page that checked would hand that back to
 * anyone with a browser. Rendering the URL's own text discloses nothing the recipient was not
 * already sent, and a made-up name looks exactly like a real one. That is the point, not a
 * shortcoming.
 *
 * textContent, never innerHTML: the path is attacker-controlled by definition. The pattern below is
 * also the app's own username shape (3-24 letters, numbers and underscores), so anything else falls
 * back to the neutral wording already in the markup rather than being echoed onto the page.
 *
 * A plain external file because the site's CSP is script-src 'self' https://e.gamesquire.app with no
 * 'unsafe-inline' - an inline block here would be silently blocked, with nothing in any log. */
(function () {
  'use strict';

  var match = /^\/u\/([A-Za-z0-9_]{3,24})\/?$/.exec(window.location.pathname);
  if (!match) return;

  var handle = '@' + match[1];

  var name = document.getElementById('invite-handle');
  if (name) name.textContent = handle;

  var them = document.getElementById('invite-them');
  if (them) them.textContent = handle + "'s";

  // The same profile inside the web app, which is where someone who already uses GameSquire in a
  // browser wants to be: it shows "Send friend request", or "already friends", for their account.
  // The capture group is the app's username shape, so it is safe to put in a path unescaped, and
  // encodeURIComponent is kept anyway as a second fence.
  var webUrl = 'https://beta.gamesquire.app/u/' + encodeURIComponent(match[1]);

  // A QR code shown on the app's QR screen carries a short-lived token (?t=, 32 hex characters).
  // Pass it on, so someone who scans it and lands in the web app becomes a friend at once, the same
  // as in the phone app (Vincent, 27 Sep 2026). Only that exact shape is copied, never anything
  // else from the query string. Without the app's matching release the web app just ignores it.
  var token = /[?&]t=([0-9a-fA-F]{32})(?:&|$)/.exec(window.location.search);
  if (token) webUrl += '?t=' + token[1].toLowerCase();
  var web = document.getElementById('invite-web');
  if (web) web.href = webUrl;

  // Skip this page entirely for someone who already uses the web app (Vincent, 26 Sep 2026). The
  // web app, signed in, sets gs_web_app=1 on .gamesquire.app and clears it on sign-out; this site
  // cannot read the login itself (a different origin keeps its own storage), so this hint is all it
  // has. It says "this browser uses the web app", not "is signed in right now": after an expired
  // session the web app's own profile screen asks them to sign in, which is still the right place.
  // location.replace, so Back returns to wherever the link was tapped, not to this page.
  if (/(?:^|;\s*)gs_web_app=1(?:;|$)/.test(document.cookie)) {
    window.location.replace(webUrl);
    return;
  }

  document.title = handle + ' invited you to GameSquire';
})();
