// GET /gift/<token>: a player's shared wishlist ("Share as gift list", GameSquire repo docs/plans/gift-list.md).
// Server-rendered on purpose: link-preview crawlers (WhatsApp, Messages) do not run JavaScript, so the name in the
// preview title must be in the HTML, and the page needs no script to work (the only script is a tiny click counter).
//
// What it shows: the player's display name, avatar emoji and colour, and per wishlist game the name, year, small
// picture, player count and playing time, plus "Where to buy" buttons for the VISITOR's country (Cloudflare's
// cf-ipcountry) from the same shop list the app uses (app_config.where_to_buy, returned by the gift-list Edge
// Function). Never a price, never anything that identifies the player.
//
// Privacy rules kept here: the page is never cached and never indexed; Referrer-Policy no-referrer, so the shop never
// sees the token in a Referer; the standard PostHog snippet is NOT loaded (it would record the page URL, which holds
// the token), and the click counter sends a count-only event with no URL and no person. Pages _headers do not apply
// to Functions responses, so this file sets every header itself (CSP included, with BoardGameGeek's image host).
//
// A stopped, unknown or malformed link all look the same: "This gift list is no longer shared".

const API = 'https://kmuvpaphebpkiueiumzw.supabase.co/functions/v1/gift-list?t=';
const TOKEN_SHAPE = /^[0-9a-f]{64}$/;
const AFFILIATE_LABEL = 'Affiliate link: GameSquire may earn a commission if you buy.';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function securityHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: https://cf.geekdo-images.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src https://e.gamesquire.app; form-action 'none'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  };
}

// ---- Shops: the same rules as the app's src/lib/where-to-buy.ts (shopsForRegion, buildShopUrl) -------------------

function isShop(x) {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Array.isArray(x.regions) &&
    typeof x.url_template === 'string' &&
    x.url_template.startsWith('https://') &&
    typeof x.tag === 'string'
  );
}

function shopsForRegion(shops, region, language) {
  if (!region) return [];
  const seen = new Set();
  return shops.filter(isShop).filter((s) => {
    if (s.tag.trim() === '' || !s.regions.some((r) => String(r).toUpperCase() === region)) return false;
    if (Array.isArray(s.languages) && s.languages.length > 0 && !(language && s.languages.some((l) => String(l).toLowerCase() === language))) return false;
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

function buildShopUrl(shop, title) {
  const once = encodeURIComponent(title);
  return shop.url_template
    .split('{query2}')
    .join(encodeURIComponent(once))
    .split('{query}')
    .join(once)
    .split('{tag}')
    .join(encodeURIComponent(shop.tag.trim()));
}

// A bol.com product page inside the shop's affiliate link: the template's own url= target is swapped for the product.
// Only an https www.bol.com page is ever used.
function productShopUrl(shop, productUrl) {
  if (!/[?&]url=/.test(shop.url_template)) return null;
  try {
    const u = new URL(productUrl);
    if (u.protocol !== 'https:' || u.hostname !== 'www.bol.com') return null;
  } catch {
    return null;
  }
  return shop.url_template
    .replace(/([?&]url=)[^&]*/, (_m, p) => p + encodeURIComponent(productUrl))
    .split('{tag}')
    .join(encodeURIComponent(shop.tag.trim()));
}

// ---- Rendering --------------------------------------------------------------------------------------------------

const STYLE = `
:root{--bg:#f2ead9;--surface:#fffaf0;--border:rgba(36,26,16,.2);--ink:#241a10;--ink2:rgba(36,26,16,.78);--ink3:rgba(36,26,16,.62);--gold:#c9962c;--on-gold:#241a10;--hdr:#3a2a18;--hdr-text:#f2ead9;--hdr-border:#241a10;--link:#8a6212;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1c140c;--surface:#2a2016;--border:rgba(242,234,217,.14);--ink:#f2ead9;--ink2:rgba(242,234,217,.7);--ink3:rgba(242,234,217,.52);--hdr:#1c140c;--link:#c9962c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1c140c;--surface:#2a2016;--border:rgba(242,234,217,.14);--ink:#f2ead9;--ink2:rgba(242,234,217,.7);--ink3:rgba(242,234,217,.52);--hdr:#1c140c;--link:#c9962c;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Work Sans',ui-sans-serif,system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit}.wrap{max-width:720px;margin:0 auto;padding:0 16px}
header{background:var(--hdr);border-bottom:1px solid var(--hdr-border);padding:16px 0}
.nav{display:flex;align-items:center;justify-content:space-between}
.wordmark{font-family:'Domine',serif;font-weight:700;font-size:1.15rem;color:var(--hdr-text);text-decoration:none}
.wordmark::before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--gold);margin-right:9px;transform:translateY(-1px)}
.theme-toggle{width:36px;height:36px;border-radius:10px;border:1px solid rgba(242,234,217,.25);background:rgba(242,234,217,.08);color:var(--hdr-text);font-size:15px;cursor:pointer}
.theme-toggle:focus-visible,a:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
main{padding:32px 0 48px}
.who{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.avatar{flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--gold)}
h1{font-family:'Domine',serif;font-weight:700;font-size:clamp(1.5rem,5vw,2.1rem);line-height:1.2;margin:0;letter-spacing:-.01em;overflow-wrap:anywhere}
.count{color:var(--ink3);font-size:.9rem;margin:0 0 20px}
.list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.card{display:flex;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px}
.pic{flex:none;width:64px;height:64px;border-radius:8px;object-fit:cover;background:rgba(127,127,127,.18)}
.info{min-width:0;flex:1}
.name{font-family:'Domine',serif;font-weight:700;font-size:1rem;margin:0;overflow-wrap:anywhere}
.meta{color:var(--ink3);font-size:.85rem;margin:2px 0 0}
.shops{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.buy{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:18px;background:var(--gold);color:var(--on-gold);font-weight:600;font-size:.85rem;text-decoration:none}
.note{color:var(--ink3);font-size:.8rem;margin:20px 0 0}
.cta{margin-top:28px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px}
.cta h2{font-family:'Domine',serif;font-size:1.05rem;margin:0 0 6px}.cta p{margin:0 0 8px;color:var(--ink2)}
.cta a{color:var(--link);text-underline-offset:2px}
.empty{padding:24px 0;color:var(--ink2)}
footer{background:var(--hdr);border-top:1px solid var(--hdr-border);padding:20px 0 32px;color:rgba(242,234,217,.62);font-size:.8rem}
footer a{text-underline-offset:2px;margin-right:14px}
@media (max-width:400px){.card{align-items:flex-start}}
`;

function page({ title, ogTitle, ogDescription, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${esc(ogDescription)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GameSquire">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDescription)}">
<meta property="og:image" content="https://gamesquire.app/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(ogDescription)}">
<meta name="twitter:image" content="https://gamesquire.app/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Domine:wght@500;700&family=Work+Sans:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>
<header><div class="wrap nav"><a class="wordmark" href="/">GameSquire</a><button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode">&#127769;</button></div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="https://squirebuilds.com">Built by Squire Builds</a></div></footer>
<script src="/assets/site.js" defer></script>
<script src="/assets/gift.js" defer></script>
</body>
</html>`;
}

const CTA = `<section class="cta"><h2>Want your own gift list?</h2><p>GameSquire is a free board game tracker with no ads. Keep a wishlist, see what your friends own and log your plays.</p><p><a href="https://apps.apple.com/app/id6804383196">iPhone or iPad</a> &middot; <a href="https://play.google.com/store/apps/details?id=com.squirebuilds.tabletracker&amp;referrer=utm_source%3Dgift%26utm_medium%3Dlist%26utm_campaign%3Dgift">Android</a> &middot; <a href="https://my.gamesquire.app/?utm_source=gift&amp;utm_medium=list&amp;utm_campaign=gift">In your browser</a></p></section>`;

function gonePage(status, headline, text) {
  const html = page({
    title: headline + ' | GameSquire',
    ogTitle: 'A board game wishlist on GameSquire',
    ogDescription: 'GameSquire is a free board game tracker. Keep a wishlist and see what your friends own.',
    body: `<h1>${esc(headline)}</h1><p class="empty">${esc(text)}</p>${CTA}`,
  });
  return new Response(html, { status, headers: securityHeaders() });
}

function range(min, max, one, many) {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  if (!a && !b) return '';
  const hi = Math.max(a, b);
  const lo = a || b;
  return lo === hi ? `${lo} ${lo === 1 ? one : many}` : `${lo}-${hi} ${many}`;
}

function gameMeta(g) {
  const parts = [];
  if (Number.isInteger(g.year) && g.year > 0) parts.push(String(g.year));
  const players = range(g.min_players, g.max_players, 'player', 'players');
  if (players) parts.push(players);
  const time = range(g.min_playtime, g.max_playtime, 'min', 'min');
  if (time) parts.push(time);
  return parts.join(' · ');
}

export async function onRequestGet({ request, params }) {
  const token = String(params.token ?? '');
  if (!TOKEN_SHAPE.test(token)) {
    return gonePage(404, 'This gift list is no longer shared', 'The person who sent you this link has stopped sharing it, or the link is not right.');
  }

  const country = String(request.headers.get('cf-ipcountry') || '').toUpperCase();
  const region = /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null;
  const langMatch = /^\s*([A-Za-z]{2})/.exec(request.headers.get('accept-language') || '');
  const language = langMatch ? langMatch[1].toLowerCase() : null;
  // The bol.com product check (GameSquire repo docs/plans/bol-product-check.md): the Edge Function answers per game
  // whether bol sells it and where its page is, for the visitor's country (BE or NL) and language (fr or nl).
  const checkQuery = region === 'BE' || region === 'NL' ? `&c=${region}&l=${language === 'fr' ? 'fr' : 'nl'}` : '';

  let upstream;
  try {
    upstream = await fetch(API + token + checkQuery, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch {
    return gonePage(502, 'We could not load this list', 'Please try again in a minute.');
  }
  if (upstream.status === 404) {
    return gonePage(404, 'This gift list is no longer shared', 'The person who sent you this link has stopped sharing it, or the link is not right.');
  }
  if (!upstream.ok) return gonePage(502, 'We could not load this list', 'Please try again in a minute.');
  let data;
  try {
    data = await upstream.json();
  } catch {
    return gonePage(502, 'We could not load this list', 'Please try again in a minute.');
  }

  const name = String(data.name || 'A GameSquire player').slice(0, 80);
  const games = Array.isArray(data.games) ? data.games : [];
  const possessive = /s$/i.test(name) ? `${name}’` : `${name}’s`;

  const wtb = data.where_to_buy && data.where_to_buy.public === true && Array.isArray(data.where_to_buy.shops) ? data.where_to_buy.shops : [];
  const shops = shopsForRegion(wtb, region, language);

  const color = /^#[0-9a-fA-F]{6}$/.test(String(data.avatar_color || '')) ? data.avatar_color : null;
  const emoji = data.avatar_emoji ? esc(String(data.avatar_emoji).slice(0, 8)) : '🎲';

  const cards = games
    .map((g) => {
      const gname = String(g.name || '').slice(0, 200);
      if (!gname) return '';
      const img =
        typeof g.image === 'string' && g.image.startsWith('https://cf.geekdo-images.com/')
          ? `<img class="pic" src="${esc(g.image)}" alt="" width="64" height="64" loading="lazy" decoding="async">`
          : `<div class="pic" aria-hidden="true"></div>`;
      const meta = gameMeta(g);
      const links = data.shop_links && typeof data.shop_links === 'object' ? data.shop_links : {};
      const link = Number.isSafeInteger(g.bgg_id) ? links[String(g.bgg_id)] : null;
      const buttons = shops
        .map((s) => {
          let href = buildShopUrl(s, gname);
          let kind = 'search';
          if (String(s.id).startsWith('bol') && link) {
            // bol does not sell this game: no button. A product page: the game's own link.
            if (link.kind === 'none') return '';
            const product = link.kind === 'product' && typeof link.url === 'string' ? productShopUrl(s, link.url) : null;
            if (product) {
              href = product;
              kind = 'product';
            }
          }
          return `<a class="buy" href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-shop="${esc(s.id)}" data-kind="${kind}" data-country="${esc(region ?? '')}" aria-label="Buy ${esc(gname)} at ${esc(s.name)}">Buy at ${esc(s.name)}</a>`;
        })
        .join('');
      return `<li class="card">${img}<div class="info"><h2 class="name">${esc(gname)}</h2>${meta ? `<p class="meta">${esc(meta)}</p>` : ''}${buttons ? `<div class="shops">${buttons}</div>` : ''}</div></li>`;
    })
    .join('');

  let disclosure = '';
  if (shops.length > 0) {
    const lines = [AFFILIATE_LABEL, `The buy buttons open ${shops.map((s) => s.name).join(' or ')}.`];
    for (const s of shops) {
      const d = String(s.disclosure || '').trim();
      if (d && !lines.includes(d)) lines.push(d);
    }
    disclosure = `<p class="note">${lines.map(esc).join(' ')}</p>`;
  }

  const count = games.length;
  const countLine = count === 1 ? '1 game' : `${count} games`;
  const body = `<div class="who"><div class="avatar" aria-hidden="true"${color ? ` style="background:${color}"` : ''}>${emoji}</div><h1>${esc(possessive)} board game wishlist</h1></div>
<p class="count">${count > 0 ? esc(countLine) : ''}</p>
${count > 0 ? `<ul class="list">${cards}</ul>` : `<p class="empty">Nothing on this wishlist right now. Check back later.</p>`}
${disclosure}
${CTA}`;

  const html = page({
    title: `${possessive} board game wishlist | GameSquire`,
    ogTitle: `${possessive} board game wishlist`,
    ogDescription: count > 0 ? `${countLine} to pick from, with where to buy them.` : 'A board game wishlist on GameSquire.',
    body,
  });
  return new Response(html, { status: 200, headers: securityHeaders() });
}
