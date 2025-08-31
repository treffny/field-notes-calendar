import Parser from 'rss-parser';
import calendar from '../../../data/calendar.json';


const parser = new Parser({ timeout: 10000 });

function parseDateSafe(d) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? Date.now() : t;
}

async function fetchRssFeed(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const feed = await parser.parseString(text);
    const items = (feed.items || []).map((it) => ({
      title: it.title || '(no title)',
      link: it.link || it.guid || '',
      createdAt: it.isoDate || it.pubDate || new Date().toISOString(),
      sourceTitle: feed.title || url,
    }));
    return { ok: true, items, meta: { title: feed.title || url } };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  try {
    const body = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const lookbackHours = Number(body.lookbackHours ?? 8760);
    const maxPerFeed = Number(body.maxPerFeed ?? 10);
    const tiers = Array.isArray(body.tiers) ? body.tiers : ['major', 'mid', 'light'];
    const cutoffMs = Date.now() - lookbackHours * 3600 * 1000;

    const urls = [];
    for (const ev of calendar) {
      if (!tiers.includes(ev.tier)) continue;
      for (const f of ev.feeds || []) {
        if (f?.type === 'rss' && f?.url) urls.push({ url: f.url, sourceName: ev.name });
      }
    }

    const results = await Promise.all(urls.map((u) => fetchRssFeed(u.url)));

    const errors = [];
    const allItems = [];

    results.forEach((r, i) => {
      const srcName = urls[i].sourceName;
      const srcUrl = urls[i].url;

      if (!r.ok) {
        errors.push({ source: srcName, url: srcUrl, error: r.error });
        return;
      }

      const picked = r.items
        .filter((it) => parseDateSafe(it.createdAt) >= cutoffMs)
        .slice(0, maxPerFeed)
        .map((it) => ({
          title: it.title,
          link: it.link,
          createdAt: it.createdAt,
          source: srcName,
        }));

      allItems.push(...picked);
    });

    const seen = new Set();
    const deduped = [];
    for (const it of allItems) {
      const key = it.link || `t:${it.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }

    deduped.sort((a, b) => parseDateSafe(b.createdAt) - parseDateSafe(a.createdAt));
    const capped = deduped.slice(0, 120);

    return res.status(200).json({
      count: capped.length,
      items: capped,
      debug: { feedsInEnv: urls.length, errors }
    });
  } catch (e) {
    return res.status(200).json({
      count: 0,
      items: [],
      debug: { error: String(e?.message || e) }
    });
  }
}

