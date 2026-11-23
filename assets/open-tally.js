/* Fills in the year on /open/tally (the address the December and January emails open).
 *
 * The page is the fallback for a phone without the app, a desktop, or an email client that does not hand the link to the
 * app. Two links need the year: "Open the app" (the app's own tabletracker:// scheme, which still works from a page on
 * gamesquire.app: on iPhone a link to the same website you are already on stays in the browser, a custom scheme does not)
 * and "Or open it on the web". The year is copied only when it is a whole number 2026 to 2100, and only that; the rest of
 * the query string (utm tags) is never put into either link.
 *
 * A plain external file because the site's CSP has no 'unsafe-inline' for scripts: an inline block would be silently
 * blocked. */
(function () {
  'use strict';

  var match = /[?&]year=(\d{4})(?:&|$)/.exec(window.location.search);
  var year = match ? Number(match[1]) : NaN;
  if (!(year >= 2026 && year <= 2100)) return;

  var open = document.getElementById('tally-open');
  if (open) open.setAttribute('href', 'tabletracker://stats/tally?year=' + year);

  var web = document.getElementById('tally-web');
  if (web) web.setAttribute('href', 'https://my.gamesquire.app/stats/tally?year=' + year);
})();
