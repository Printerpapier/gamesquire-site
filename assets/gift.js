// /gift/<token>: counts a tap on a shop button as `gift_list_shop_clicked`. Count only: no page URL (it holds the
// link's secret token), no game name, no person. It deliberately does not use the site's PostHog snippet
// (assets/analytics.js), which records the page URL. Sent straight to the same first-party proxy the site uses.
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[data-shop]') : null;
  if (!a) return;
  try {
    var body = JSON.stringify({
      api_key: 'phc_mfD2teKjbBUVgLeGFnXqNF4cNJecNcyhpLp5b6iLtdji',
      event: 'gift_list_shop_clicked',
      distinct_id: 'system:gift-list',
      properties: {
        shop_id: a.getAttribute('data-shop'),
        link_kind: a.getAttribute('data-kind') || 'search',
        country: a.getAttribute('data-country') || null,
        $process_person_profile: false,
        $current_url: 'https://gamesquire.app/gift/',
        $geoip_disable: true,
      },
    });
    if (navigator.sendBeacon) navigator.sendBeacon('https://e.gamesquire.app/capture/', new Blob([body], { type: 'text/plain' }));
  } catch (err) {
    /* never get in the way of the link */
  }
});
