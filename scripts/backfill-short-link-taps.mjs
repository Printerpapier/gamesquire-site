// One-off: sends the short-link taps Cloudflare still holds as `short_link_tapped` events (backfilled: true), so the charts
// have history from the first real tap (4 Nov 2026) instead of starting on the day the counting went live.
//
//   node scripts/backfill-short-link-taps.mjs                 dry run: prints totals per source, sends nothing
//   node scripts/backfill-short-link-taps.mjs --send          sends (only after the SPoC says go)
//   --until YYYY-MM-DD   leave out this day and later (set it to the day the counting went live, so nothing is counted twice)
//   --file <csv>         default scripts/data/short-link-history-2026-11-16.csv
//   --max-send <n>       brake, default 2000
//
// The CSV is Cloudflare's zone analytics (GraphQL httpRequestsAdaptiveGroups) for exact short-link paths that answered 302,
// one row per day, source, destination, country and bot flag, bots decided by a copy of the live Function's isBot() run on the user agent when the CSV was made (the user agents themselves are not kept); own setup tests (country BE, curl/node) removed. It
// covers 28 Oct to 15 Nov 2026 (Cloudflare keeps 4 weeks and 2 days of this data). Adaptive analytics is SAMPLED on busy
// days (interval 1 to 10), so the counts are estimates; a day's taps are spread evenly over the day, because the hour is
// not kept. Re-running is safe: every event has a fixed uuid derived from its row, so PostHog drops duplicates.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isBot, utmSourceFor } from '../functions/_lib/short-links.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const send = flag('--send');
const until = opt('--until', '9999-12-31');
const maxSend = Number(opt('--max-send', '2000'));
const file = opt('--file', new URL('./data/short-link-history-2026-11-16.csv', import.meta.url));

const POSTHOG_BATCH = 'https://e.gamesquire.app/batch/';
const POSTHOG_KEY = 'phc_mfD2teKjbBUVgLeGFnXqNF4cNJecNcyhpLp5b6iLtdji';

void isBot; // the CSV carries the verdict already; imported so a changed classifier is visible in review

function uuidFrom(text) {
  const h = createHash('sha1').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const rows = readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1).map((l) => {
  const [day, source, destination, country, bot, count] = l.split(',');
  return { day, source, destination, country, bot: bot === '1', count: Number(count) };
}).filter((r) => r.day < until);

const events = [];
for (const r of rows) {
  for (let i = 0; i < r.count; i++) {
    const at = new Date(Date.parse(`${r.day}T00:00:00Z`) + ((i + 0.5) / r.count) * 86400000);
    const key = ['short-link-backfill', r.day, r.source, r.destination, r.country, r.bot ? 1 : 0, i].join('|');
    events.push({
      event: 'short_link_tapped',
      uuid: uuidFrom(key),
      distinct_id: 'short-link-taps',
      timestamp: at.toISOString(),
      properties: {
        source: r.source,
        utm_source: utmSourceFor(r.source),
        destination: r.destination,
        path: `/${r.source}${r.destination === 'web' ? '' : `/${r.destination}`}`,
        host: 'gamesquire.app',
        country: r.country,
        is_bot: r.bot,
        backfilled: true,
        $process_person_profile: false,
        $geoip_disable: true,
        $lib: 'gamesquire-short-link',
      },
    });
  }
}

const by = {};
for (const e of events) {
  const k = `${e.properties.source}${e.properties.is_bot ? ' (bots)' : ''}`;
  by[k] = (by[k] ?? 0) + 1;
}
const human = events.filter((e) => !e.properties.is_bot).length;
console.log(`rows ${rows.length}, events ${events.length} (people ${human}, bots ${events.length - human}), days ${rows[0]?.day} to ${rows.at(-1)?.day}`);
console.log(by);
if (!send) {
  console.log('dry run, nothing sent. Add --send to send.');
  process.exit(0);
}
if (events.length > maxSend) {
  console.error(`refusing: ${events.length} events is over --max-send ${maxSend}`);
  process.exit(1);
}
for (let i = 0; i < events.length; i += 100) {
  const res = await fetch(POSTHOG_BATCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, batch: events.slice(i, i + 100) }),
  });
  if (!res.ok) {
    console.error(`batch at ${i} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
}
console.log(`sent ${events.length} events`);
