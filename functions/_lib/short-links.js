// Short links handed out by MarketingOutreach drafts and by Vincent (gamesquire.app/<source>, plus /android, /iphone and
// /more for six of them). ONE table here is the single source of truth for where each path forwards. It replaced the
// matching lines of _redirects (16 Nov 2026, board 240) so that every tap can also be counted. The targets are
// byte-identical to the old _redirects lines (scripts/compare-short-links.mjs checks it against production).
//
// A tap answers 302 at once and sends ONE event to PostHog in the background (context.waitUntil), so a slow or failing
// PostHog can never delay or break the forward. No IP, no cookie, no person profile: a random id per tap, the country
// Cloudflare already knows, the path, the source and where it forwards. Crawlers (link previews and search bots) are
// recorded with is_bot true so charts can leave them out; whoever reads taps filters is_bot = false.

// The PUBLIC project key (it also ships in every app build), the same one /store-check uses.
const POSTHOG_URL = 'https://e.gamesquire.app/i/v0/e/';
const POSTHOG_KEY = 'phc_mfD2teKjbBUVgLeGFnXqNF4cNJecNcyhpLp5b6iLtdji';

// path source -> [utm_source, utm_medium]
const SOURCES = {
  reddit: ['reddit', 'social'],
  bluesky: ['bluesky', 'social'],
  x: ['x', 'social'],
  instagram: ['instagram', 'social'],
  tiktok: ['tiktok', 'social'],
  hello: ['press', 'email'],
  bgg: ['bgg', 'social'],
  discord: ['discord', 'social'],
  club: ['club', 'social'],
};

/** Sources that also have a /more link (the landing page itself, tagged). Not bgg, discord or club: those never had one. */
export const MORE_SOURCES = ['reddit', 'bluesky', 'x', 'instagram', 'tiktok', 'hello'];
export const ALL_SOURCES = Object.keys(SOURCES);

/** Where a short link forwards: destination is web, android, iphone or more. */
export function targetFor(source, destination) {
  const [utm, medium] = SOURCES[source];
  const tag = `utm_source=${utm}&utm_medium=${medium}&utm_campaign=marketing`;
  if (destination === 'more') return `/?${tag}`;
  if (destination === 'android') {
    return `https://play.google.com/store/apps/details?id=com.squirebuilds.tabletracker&referrer=utm_source%3D${utm}%26utm_medium%3D${medium}%26utm_campaign%3Dmarketing`;
  }
  if (destination === 'iphone') return `https://apps.apple.com/app/apple-store/id6804383196?pt=129168901&ct=${utm}&mt=8`;
  return `https://my.gamesquire.app/?${tag}`;
}

/** The utm_source a path source stands for (hello is press). */
export function utmSourceFor(source) {
  return SOURCES[source][0];
}

/** Bot unless it looks like a real browser: a missing or odd user agent counts as a bot, so a bad guess never inflates a
 * count. scripts/backfill-short-link-taps.mjs imports this very function, so history and live taps are judged alike. */
export function isBot(userAgent) {
  const ua = String(userAgent ?? '');
  if (!ua.startsWith('Mozilla/5.0')) return true; // curl, node, python, "nginx-ssl early hints", help@dataminr.com ...
  if (!/AppleWebKit|Gecko\/|Chrome\/|Safari\/|Firefox\//.test(ua)) return true;
  if (
    /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skywatch|lighthouse|headless|phantom|scrapy|python|curl|wget|axios|java\/|go-http|perplexity|semrush|ahrefs|mention|trendiction|livelap|keenable|dataminr|reader|check|monitor|scan|fetch|\+https?:|PPC Mac OS X|EmergedDrafter/i.test(
      ua,
    )
  ) {
    return true;
  }
  return false;
}

/** The handler every short-link route file exports. */
export function shortLink(source, destination) {
  return async function onRequest({ request, waitUntil }) {
    // Only a real visit counts: a HEAD or OPTIONS probe forwards but is not a tap.
    if (request.method === 'GET') {
      try {
        const url = new URL(request.url);
        waitUntil(
          fetch(POSTHOG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: POSTHOG_KEY,
              event: 'short_link_tapped',
              distinct_id: crypto.randomUUID(),
              properties: {
                source,
                utm_source: utmSourceFor(source),
                destination,
                path: url.pathname,
                host: url.hostname,
                country: request.cf?.country ?? null,
                is_bot: isBot(request.headers.get('user-agent')),
                backfilled: false,
                $process_person_profile: false,
                $geoip_disable: true,
                $lib: 'gamesquire-short-link',
              },
            }),
          }).catch(() => {}),
        );
      } catch {
        // never let counting break the forward
      }
    }
    const target = targetFor(source, destination);
    // Same content type as the redirect Cloudflare itself sent before (text/plain), with the target as body.
    return new Response(target, {
      status: 302,
      headers: { Location: target, 'Content-Type': 'text/plain;charset=UTF-8', 'X-Short-Link': 'counted' },
    });
  };
}
