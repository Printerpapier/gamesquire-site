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
  if (them) them.textContent = handle;

  document.title = handle + ' invited you to GameSquire';
})();
