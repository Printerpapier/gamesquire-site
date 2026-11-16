// Compares how two hosts answer every short link and a set of control paths: status, Location and content type.
// Usage: node scripts/compare-short-links.mjs https://gamesquire.app https://short-link-taps.gamesquire-site.pages.dev
// Exit code 1 when any path differs. Redirects are never followed, so Location is compared byte for byte.
const [a, b] = process.argv.slice(2).map((u) => u.replace(/\/$/, ''));
if (!a || !b) {
  console.error('usage: node scripts/compare-short-links.mjs <baseline> <candidate>');
  process.exit(2);
}

const all = ['reddit', 'bluesky', 'x', 'instagram', 'tiktok', 'hello', 'bgg', 'discord', 'club'];
const paths = [];
for (const s of all) {
  for (const d of ['', '/android', '/iphone', '/more']) {
    paths.push(`/${s}${d}`, `/${s}${d}/`);
  }
  paths.push(`/${s}?x=1`, `/${s}/foo`, `/${s}/android/foo`);
}
// Controls: pages and files that must be untouched.
paths.push(
  '/', '/privacy', '/terms', '/support', '/u/test', '/u/someone/', '/invite', '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json', '/api/news-confirm', '/robots.txt', '/sitemap.xml', '/no-such-page', '/reddits', '/xyz',
);

async function probe(base, path) {
  try {
    const res = await fetch(base + path, { redirect: 'manual', headers: { 'User-Agent': 'short-link-compare/1' } });
    return `${res.status} | ${res.headers.get('location') ?? ''} | ${(res.headers.get('content-type') ?? '').split(';')[0]}`;
  } catch (e) {
    return `ERROR ${e.message}`;
  }
}

let differ = 0;
for (const p of paths) {
  const [x, y] = await Promise.all([probe(a, p), probe(b, p)]);
  if (x !== y) {
    differ += 1;
    console.log(`DIFF ${p}\n   ${a}: ${x}\n   ${b}: ${y}`);
  }
}
console.log(`${paths.length} paths compared, ${differ} differ`);
process.exit(differ ? 1 : 0);
