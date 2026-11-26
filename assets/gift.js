// /gift/<token>: counts a tap on a shop button as `gift_list_shop_clicked`. The tap is sent to the gift-list Edge
// Function (public, no sign-in), which looks up whose list this is and sends the event as that owner, so PostHog's
// test-account rule can drop test lists. The page never knows the owner: only the link's own token (already in the
// address bar) goes out, to our own server, never to PostHog. No game name, no page URL. It deliberately does not use
// the site's PostHog snippet (assets/analytics.js), which records the page URL.
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[data-shop]') : null;
  if (!a) return;
  try {
    var m = /^\/gift\/([0-9a-f]{64})\/?$/.exec(location.pathname);
    if (!m) return;
    var body = JSON.stringify({
      action: 'shop_click',
      t: m[1],
      shop_id: a.getAttribute('data-shop'),
      link_kind: a.getAttribute('data-kind') || 'search',
      country: a.getAttribute('data-country') || null,
    });
    if (navigator.sendBeacon) navigator.sendBeacon('https://kmuvpaphebpkiueiumzw.supabase.co/functions/v1/gift-list', new Blob([body], { type: 'text/plain' }));
  } catch (err) {
    /* never get in the way of the link */
  }
});
